// Offline-first sync. Attempts are append-only (idempotent union). Docs use optimistic versions;
// on a version conflict the client merges with merge.js and pushes again.
import { mergeDocs } from './merge.js';
const PAGE = 500, BATCH = 200;
export class Syncer {
  constructor(repo, transport, { onStatus } = {}) { this.repo = repo; this.t = transport; this.onStatus = onStatus || (() => { }); this.running = null; }
  async pending() { return { attempts: await this.repo.store.countUnsyncedAttempts(), docs: (await this.repo.store.dirtyDocs()).length }; }
  sync() { if (this.running) return this.running; this.running = this._sync().finally(() => { this.running = null; }); return this.running; }
  async _sync() {
    const st = this.repo.store; const out = { pulledAttempts: 0, pulledDocs: 0, pushedAttempts: 0, pushedDocs: 0, conflicts: 0 };
    try {
      this.onStatus({ state: 'syncing' });
      await this._pull(out);
      for (let round = 0; round < 4; round++) {
        const attempts = await st.unsyncedAttempts(BATCH); const dirty = await st.dirtyDocs();
        if (!attempts.length && !dirty.length) break;
        const snap = new Map(dirty.map(d => [d.kind + '/' + d.key, d.updated_at]));
        const res = await this.t.push(attempts.map(a => ({ ...a })), dirty.map(d => ({ kind: d.kind, key: d.key, data: d.data, base_version: d.version, updated_at: d.updated_at, deleted: d.deleted, device_id: d.device_id })));
        await st.markSynced(attempts.map(a => a.id)); out.pushedAttempts += attempts.length;
        for (const acc of res.accepted || []) {
          const cur = await st.getDoc(acc.kind, acc.key); if (!cur) continue;
          cur.version = acc.version; if (cur.updated_at === snap.get(acc.kind + '/' + acc.key)) cur.dirty = false; // unchanged since push → clean
          await st.putDoc(cur); out.pushedDocs++;
        }
        for (const c of res.conflicts || []) { await this._resolve(c, out); }
        if (!(res.conflicts || []).length && attempts.length < BATCH) { /* loop continues only if more work */ }
      }
      await st.setMeta('lastSync', new Date().toISOString());
      await this.repo.reloadFromStore();
      this.onStatus({ state: 'ok', at: new Date().toISOString(), ...out, pending: await this.pending() });
      return out;
    } catch (e) {
      this.onStatus({ state: e && e.code === 'auth' ? 'auth' : 'error', error: String(e && e.message || e), pending: await this.pending() });
      throw e;
    }
  }
  async _pull(out) {
    const st = this.repo.store;
    let ds = (await st.getMeta('docSeq')) || 0;
    for (;;) { const rows = await this.t.pullDocs(ds, PAGE); for (const r of rows) { await this._resolve(r, out, true); ds = Math.max(ds, r.server_seq); } await st.setMeta('docSeq', ds); if (rows.length < PAGE) break; }
    let as = (await st.getMeta('attSeq')) || 0;
    for (;;) { const rows = await this.t.pullAttempts(as, PAGE); for (const r of rows) { const { user_id, server_seq, created_at, ...a } = r; if (await st.addAttemptIfMissing({ ...a, client_ts: new Date(a.client_ts).toISOString() })) out.pulledAttempts++; as = Math.max(as, server_seq); } await st.setMeta('attSeq', as); if (rows.length < PAGE) break; }
  }
  async _resolve(remote, out, fromPull = false) {
    const st = this.repo.store; const local = await st.getDoc(remote.kind, remote.key);
    const rdoc = { kind: remote.kind, key: remote.key, data: remote.data, version: remote.version, updated_at: new Date(remote.updated_at).toISOString(), deleted: !!remote.deleted, device_id: remote.device_id, dirty: false };
    if (!local) { await st.putDoc(rdoc); if (fromPull) out.pulledDocs++; return; }
    if (!local.dirty) { if (remote.version >= local.version) { await st.putDoc(rdoc); if (fromPull) out.pulledDocs++; } return; }
    if (remote.version === local.version) return; // same base, local edits still pending
    const { data, lost } = mergeDocs(remote.kind, local, rdoc);
    const merged = { ...local, data, version: remote.version, dirty: true, updated_at: new Date().toISOString() };
    await st.putDoc(merged); out.conflicts++;
    await st.addConflict({ at: new Date().toISOString(), kind: remote.kind, key: remote.key, local: local.data, remote: remote.data, merged: data, lost, rule: lost ? 'last-writer-wins (loser kept here)' : 'field-level merge' });
  }
}
// ---- Real transport: Supabase REST (PostgREST + GoTrue) using plain fetch; no SDK needed.
export class RestTransport {
  constructor(cfg, auth) { this.cfg = cfg; this.auth = auth; }
  async _fetch(path, opts = {}) {
    const tok = await this.auth.accessToken(); if (!tok) { const e = new Error('Not signed in'); e.code = 'auth'; throw e; }
    const res = await fetch(this.cfg.url + path, { ...opts, headers: { apikey: this.cfg.anonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (res.status === 401) { const e = new Error('Session expired. Please sign in again.'); e.code = 'auth'; throw e; }
    if (!res.ok) throw new Error(`Server error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
  }
  pullDocs(since, limit) { return this._fetch(`/rest/v1/docs?select=*&server_seq=gt.${since}&order=server_seq.asc&limit=${limit}`); }
  pullAttempts(since, limit) { return this._fetch(`/rest/v1/attempts?select=*&server_seq=gt.${since}&order=server_seq.asc&limit=${limit}`); }
  push(attempts, docs) { return this._fetch('/rest/v1/rpc/push_changes', { method: 'POST', body: JSON.stringify({ p_attempts: attempts, p_docs: docs }) }); }
  resetRemote() { return this._fetch('/rest/v1/rpc/reset_my_data', { method: 'POST', body: '{}' }); }
}
