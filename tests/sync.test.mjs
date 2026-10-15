import { test, done, eq, ok, content } from './helpers.mjs';
import { MemoryStore } from '../app/js/store.js';
import { Repo, detId } from '../app/js/repo.js';
import { Syncer } from '../app/js/sync.js';
import { mergeDocs } from '../app/js/merge.js';

// Mock server mirroring supabase/migrations push_changes + REST pulls (one user).
class MockServer {
  constructor() { this.attempts = []; this.docs = new Map(); this.seq = 0; this.online = true; this.calls = 0; }
  _chk() { if (!this.online) throw new TypeError('Failed to fetch'); this.calls++; }
  async pullDocs(since, limit) { this._chk(); return [...this.docs.values()].filter(d => d.server_seq > since).sort((a, b) => a.server_seq - b.server_seq).slice(0, limit).map(d => JSON.parse(JSON.stringify(d))); }
  async pullAttempts(since, limit) { this._chk(); return this.attempts.filter(a => a.server_seq > since).slice(0, limit).map(a => ({ ...a })); }
  async push(attempts, docs) {
    this._chk(); let ins = 0; const accepted = [], conflicts = [];
    for (const a of attempts) if (!this.attempts.some(x => x.id === a.id)) { this.attempts.push({ ...a, user_id: 'u', server_seq: ++this.seq, created_at: new Date().toISOString() }); ins++; }
    for (const d of docs) {
      const k = d.kind + '/' + d.key, cur = this.docs.get(k);
      if (!cur) { const row = { kind: d.kind, key: d.key, data: d.data, version: 1, updated_at: d.updated_at, deleted: d.deleted, device_id: d.device_id, server_seq: ++this.seq }; this.docs.set(k, row); accepted.push({ kind: d.kind, key: d.key, version: 1, server_seq: row.server_seq }); }
      else if (cur.version === d.base_version) { Object.assign(cur, { data: d.data, version: cur.version + 1, updated_at: d.updated_at, deleted: d.deleted, device_id: d.device_id, server_seq: ++this.seq }); accepted.push({ kind: d.kind, key: d.key, version: cur.version, server_seq: cur.server_seq }); }
      else conflicts.push(JSON.parse(JSON.stringify(cur)));
    }
    return { attempts_inserted: ins, accepted, conflicts };
  }
}
const mkDevice = async (srv, id) => { const store = new MemoryStore(); await store.init(); const repo = new Repo(store, { content, deviceId: id }); await repo.load(); return { repo, store, sync: new Syncer(repo, srv), id }; };
const q = Object.values(content.lessons)[0].quiz[0]; const LID = Object.values(content.lessons)[0].id;
const rec = (d, o = {}) => d.repo.recordAttempt({ kind: 'quiz', lesson_id: LID, item_id: q.id, skill_id: q.id.split('-')[0], concept: q.concept, score: 1, ...o });

console.log('sync');
await test('attempts made offline on two devices merge by union on both', async () => {
  const srv = new MockServer(); const phone = await mkDevice(srv, 'phone'), laptop = await mkDevice(srv, 'laptop');
  srv.online = false; await rec(phone); await rec(phone); await rec(laptop);
  let failed = false; try { await phone.sync.sync(); } catch { failed = true; } ok(failed, 'offline sync fails cleanly');
  eq((await phone.sync.pending()).attempts, 2, 'nothing lost while offline');
  srv.online = true; await phone.sync.sync(); await laptop.sync.sync(); await phone.sync.sync();
  eq(phone.repo.attempts.length, 3); eq(laptop.repo.attempts.length, 3); eq(srv.attempts.length, 3);
});
await test('re-sync is idempotent (no duplicates), even if mark-synced was lost mid-flight', async () => {
  const srv = new MockServer(); const a = await mkDevice(srv, 'a'); await rec(a); await a.sync.sync();
  await a.store.putAttempt({ ...(await a.store.allAttempts())[0], synced: false }); // simulate crash before marking synced
  await a.sync.sync(); await a.sync.sync(); eq(srv.attempts.length, 1); eq(a.repo.attempts.length, 1);
});
await test('doc conflict: lesson progress merges forward (union of sections, earliest completion)', async () => {
  const srv = new MockServer(); const A = await mkDevice(srv, 'A'), B = await mkDevice(srv, 'B');
  await A.repo.saveDoc('lesson', 'x-1', { startedAt: '2026-03-01T09:00:00Z', sections: { concept: '2026-03-01T09:05:00Z' } }); await A.sync.sync(); await B.sync.sync();
  await A.repo.updateDoc('lesson', 'x-1', d => { d.sections.examples = '2026-03-01T09:10:00Z'; return d; }); 
  await B.repo.updateDoc('lesson', 'x-1', d => { d.sections.quiz = '2026-03-01T09:20:00Z'; d.completedAt = '2026-03-01T09:21:00Z'; return d; });
  await A.sync.sync(); const out = await B.sync.sync(); await A.sync.sync(); await B.sync.sync();
  ok(out.conflicts === 1, 'conflict detected'); const a = A.repo.getDoc('lesson', 'x-1').data, b = B.repo.getDoc('lesson', 'x-1').data;
  eq(Object.keys(a.sections).sort(), ['concept', 'examples', 'quiz']); eq(a, b, 'converged'); eq(a.completedAt, '2026-03-01T09:21:00Z');
  eq((await B.store.allConflicts()).length, 1, 'conflict logged');
});
await test('settings conflict resolves per field by newest timestamp', async () => {
  const srv = new MockServer(); const A = await mkDevice(srv, 'A'), B = await mkDevice(srv, 'B');
  await A.repo.setSetting('reviewCap', 10); await A.sync.sync(); await B.sync.sync();
  await A.repo.setSetting('reviewCap', 15); await new Promise(r => setTimeout(r, 5)); await B.repo.setSetting('theme', 'dark'); await B.repo.setSetting('reviewCap', 20);
  await A.sync.sync(); await B.sync.sync(); await A.sync.sync(); await B.sync.sync();
  eq(A.repo.settings().reviewCap, 20); eq(A.repo.settings().theme, 'dark'); eq(B.repo.settings().reviewCap, 20);
});
await test('last-writer-wins doc (reflection): loser is preserved in the conflict log', async () => {
  const srv = new MockServer(); const A = await mkDevice(srv, 'A'), B = await mkDevice(srv, 'B');
  await A.repo.saveDoc('reflection', '2026-03-01', { text: 'base' }); await A.sync.sync(); await B.sync.sync();
  await A.repo.saveDoc('reflection', '2026-03-01', { text: 'from phone' }); await new Promise(r => setTimeout(r, 5)); await B.repo.saveDoc('reflection', '2026-03-01', { text: 'from laptop (newer)' });
  await A.sync.sync(); await B.sync.sync(); await A.sync.sync();
  eq(A.repo.getDoc('reflection', '2026-03-01').data.text, 'from laptop (newer)'); eq(B.repo.getDoc('reflection', '2026-03-01').data.text, 'from laptop (newer)');
  const c = (await B.store.allConflicts())[0]; eq(c.lost.text, 'from phone', 'older text kept for recovery');
});
await test('assessment run submitted on both devices converges, deterministic attempt ids avoid duplicates', async () => {
  const srv = new MockServer(); const A = await mkDevice(srv, 'A'), B = await mkDevice(srv, 'B');
  const run = (t) => ({ defId: 'week-1', items: ['i1'], answers: { i1: { v: 1, ts: 1 } }, status: 'submitted', complete: true, submittedAt: t, result: { pct: 0.8, passed: true } });
  const id = detId('run1|i1');
  for (const [D, t] of [[A, '2026-03-07T10:00:00Z'], [B, '2026-03-07T10:05:00Z']]) { await D.repo.saveDoc('assessment_run', 'run1', run(t)); await D.repo.recordAttempt({ id, kind: 'assessment', score: 1, item_id: 'i1', skill_id: 'english' }); }
  await A.sync.sync(); await B.sync.sync(); await A.sync.sync();
  eq(srv.attempts.length, 1, 'one attempt'); eq(A.repo.getDoc('assessment_run', 'run1').data.submittedAt, '2026-03-07T10:00:00Z', 'first submission wins'); eq(B.repo.getDoc('assessment_run', 'run1').data.submittedAt, '2026-03-07T10:00:00Z');
});
await test('edit made while a push is in flight stays dirty and syncs next time', async () => {
  const srv = new MockServer(); const A = await mkDevice(srv, 'A'); await A.repo.saveDoc('plan', 'main', { n: 1 });
  const orig = srv.push.bind(srv); srv.push = async (...a) => { const r = await orig(...a); await new Promise(r => setTimeout(r, 3)); await A.repo.saveDoc('plan', 'main', { n: 2 }); return r; };
  await A.sync.sync(); srv.push = orig; eq((await A.sync.pending()).docs, 1, 'still dirty'); await A.sync.sync(); eq(srv.docs.get('plan/main').data.n, 2); eq((await A.sync.pending()).docs, 0);
});
await test('new device downloads full history (recovery); cursors make later pulls incremental', async () => {
  const srv = new MockServer(); const A = await mkDevice(srv, 'A'); for (let i = 0; i < 5; i++) await rec(A); await A.repo.saveDoc('lesson', 'x-1', { sections: {}, completedAt: 't' }); await A.sync.sync();
  const N = await mkDevice(srv, 'new'); const r = await N.sync.sync(); eq(r.pulledAttempts, 5); eq(r.pulledDocs, 1);
  const r2 = await N.sync.sync(); eq(r2.pulledAttempts, 0); eq(r2.pulledDocs, 0);
});
await test('mergeDocs is commutative for the field-merge kinds', () => {
  const l = { data: { sections: { a: 't1' }, completedAt: null, startedAt: 's2' }, updated_at: '2026-01-02' }, r = { data: { sections: { b: 't2' }, completedAt: 'c1', startedAt: 's1' }, updated_at: '2026-01-01' };
  eq(mergeDocs('lesson', l, r).data, mergeDocs('lesson', r, l).data);
  const t1 = { data: { checked: [true, false], evidence: 'old', evidenceTs: 1 }, updated_at: 'a' }, t2 = { data: { checked: [false, true, true], evidence: 'new', evidenceTs: 2 }, updated_at: 'b' };
  eq(mergeDocs('task', t1, t2).data, mergeDocs('task', t2, t1).data); eq(mergeDocs('task', t1, t2).data.checked, [true, true, true]);
});
done();
