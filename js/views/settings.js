import { h, mdEl, toast, confirmDialog, pctText } from '../ui/lib.js';
import { RULES_TEXT } from '../engine/grading.js';
import { SRS_RULES } from '../engine/srs.js';
import { MASTERY_RULES } from '../engine/derive.js';
import { RULES } from '../engine/recommend.js';
import { mergeDocs } from '../merge.js';
import { listProviders } from '../ai/provider.js';
import { dayKey } from '../engine/util.js';

export const EXPORT_FORMAT = 'skill-mastery-backup';
export async function buildExport(repo) { return { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), deviceId: repo.deviceId, attempts: await repo.store.allAttempts(), docs: (await repo.store.allDocs()).map(({ dirty, ...d }) => d) }; }
export function validateBackup(o) {
  if (!o || o.format !== EXPORT_FORMAT) throw new Error('This file is not a Skill Mastery backup.');
  if (o.version !== 1) throw new Error('Unsupported backup version ' + o.version);
  if (!Array.isArray(o.attempts) || !Array.isArray(o.docs)) throw new Error('Backup is missing attempts or documents.');
  for (const a of o.attempts) if (!a || typeof a.id !== 'string' || typeof a.kind !== 'string' || typeof a.score !== 'number' || !a.client_ts || isNaN(Date.parse(a.client_ts))) throw new Error('Backup contains a malformed attempt (id ' + (a && a.id) + ').');
  for (const d of o.docs) if (!d || typeof d.kind !== 'string' || typeof d.key !== 'string' || typeof d.data !== 'object' || d.data === null) throw new Error('Backup contains a malformed document.');
  return o;
}
export async function importBackup(repo, o, mode) {
  validateBackup(o); let a = 0, d = 0;
  if (mode === 'replace') await repo.store.clearAll();
  const have = new Set(mode === 'replace' ? [] : (await repo.store.allAttempts()).map(y => y.id));
  for (const x of o.attempts) { const { synced, ...att } = x; if (!have.has(att.id)) { await repo.store.putAttempt({ ...att, synced: false }); a++; } }
  for (const x of o.docs) {
    const cur = mode === 'replace' ? null : await repo.store.getDoc(x.kind, x.key);
    const inc = { kind: x.kind, key: x.key, data: x.data, version: cur ? cur.version : 0, updated_at: x.updated_at || new Date().toISOString(), deleted: !!x.deleted, device_id: x.device_id || repo.deviceId, dirty: true };
    if (cur) { const m = mergeDocs(x.kind, cur, inc); inc.data = m.data; inc.updated_at = new Date().toISOString(); }
    await repo.store.putDoc(inc); d++;
  }
  await repo.load(); return { attempts: a, docs: d };
}
const download = (name, text, type = 'application/json') => { const u = URL.createObjectURL(new Blob([text], { type })); const a = h('a', { href: u, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); };

export function settingsView(ctx) {
  const { repo, auth, syncer, content } = ctx; const s = repo.settings(); const root = h('div', { class: 'view' }, h('h1', 'Settings'));
  // ---- Account & sync
  const acct = h('section', { class: 'card' }); root.append(acct);
  const drawAcct = async () => {
    acct.replaceChildren(h('h2', 'Account and sync')); const u = auth.user(); const pend = await syncer.pending(); const last = await repo.store.getMeta('lastSync');
    if (u) {
      acct.append(h('p', 'Signed in as ', h('strong', u.email)), h('p', { class: 'sm muted' }, `Last sync: ${last ? new Date(last).toLocaleString() : 'never'} · waiting to upload: ${pend.attempts} attempt(s), ${pend.docs} document(s) · ${navigator.onLine ? 'online' : 'offline'}`),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { try { const r = await syncer.sync(); toast(`Synced: ↓${r.pulledAttempts + r.pulledDocs} ↑${r.pushedAttempts + r.pushedDocs}` + (r.conflicts ? ` · ${r.conflicts} conflict(s) merged` : ''), 'ok'); } catch (e) { toast('Sync failed: ' + e.message); } drawAcct(); } }, 'Sync now'), h('button', { class: 'btn ghost', onclick: async () => { if (await confirmDialog('Re-download everything from your account? Local unsynced changes are kept and merged.')) { await repo.store.setMeta('docSeq', 0); await repo.store.setMeta('attSeq', 0); try { const r = await syncer.sync(); toast('Recovered ' + r.pulledAttempts + ' attempts', 'ok'); } catch (e) { toast('Failed: ' + e.message); } drawAcct(); } } }, 'Re-download all'), h('button', { class: 'btn ghost', onclick: async () => { await auth.signOut(); toast('Signed out. Your data stays on this device.'); drawAcct(); } }, 'Sign out')));
    } else {
      const email = h('input', { class: 'txt', type: 'email', autocomplete: 'email', placeholder: 'Email', 'aria-label': 'Email' }), pw = h('input', { class: 'txt', type: 'password', autocomplete: 'current-password', placeholder: 'Password (min 8 characters)', 'aria-label': 'Password' }); const msg = h('p', { class: 'sm' });
      const run = (fn) => async () => { msg.textContent = ''; if (!email.value || pw.value.length < 8) { msg.textContent = 'Enter an email and a password of at least 8 characters.'; return; } try { const r = await fn(email.value.trim(), pw.value); if (r && r.needsConfirmation) { msg.textContent = 'Account created. Check your email for a confirmation link, then sign in here.'; return; } await ctx.afterSignIn(); drawAcct(); } catch (e) { msg.textContent = !navigator.onLine ? 'You are offline. Sign in when you have a connection; the app works offline meanwhile.' : e.message; } };
      acct.append(h('p', { class: 'muted' }, 'You can use everything without an account. Sign in to sync progress between your phone and laptop. Your data is private to your account.'), email, pw, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: run((e, p) => auth.signIn(e, p)) }, 'Sign in'), h('button', { class: 'btn ghost', onclick: run((e, p) => auth.signUp(e, p)) }, 'Create account'), h('button', { class: 'btn ghost', onclick: async () => { if (!email.value) { msg.textContent = 'Enter your email first.'; return; } try { await auth.resetPassword(email.value.trim()); msg.textContent = 'If that account exists, a reset email is on its way.'; } catch (e) { msg.textContent = e.message; } } }, 'Forgot password')), msg);
    }
  }; drawAcct(); ctx.onSyncStatus(drawAcct, root);
  // ---- Preferences
  const pref = h('section', { class: 'card' }, h('h2', 'Preferences'));
  const field = (label, el, help) => h('label', { class: 'field' }, h('span', label), el, help ? h('small', { class: 'muted' }, help) : null);
  const start = h('input', { class: 'txt', type: 'date', value: s.startDate || dayKey(), onchange: e => repo.setSetting('startDate', e.target.value).then(() => toast('Start date saved')) });
  const cap = h('select', { class: 'txt', onchange: e => repo.setSetting('reviewCap', +e.target.value) }, [6, 8, 12, 16, 20, 30].map(n => h('option', { value: n, selected: n === s.reviewCap || null }, `${n} items (~${Math.round(n * .65)} min)`)));
  const diff = h('select', { class: 'txt', onchange: e => repo.setSetting('difficulty', e.target.value) }, [['auto', 'Automatic (recommended)'], ['easier', 'Easier: hints open, stretch optional'], ['harder', 'Harder: stretch recommended']].map(([v, l]) => h('option', { value: v, selected: v === s.difficulty || null }, l)));
  const theme = h('select', { class: 'txt', onchange: e => { repo.setSetting('theme', e.target.value); document.documentElement.dataset.theme = e.target.value === 'auto' ? '' : e.target.value; } }, [['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => h('option', { value: v, selected: v === s.theme || null }, l)));
  pref.append(field('Curriculum start date', start, 'Changes the calendar only; your progress is unaffected.'), field('Review session size', cap, 'Extra due items roll over to later sessions.'), field('Practice difficulty', diff, 'Overrides the automatic recommendation.'), field('Theme', theme)); root.append(pref);
  // ---- Backup & recovery
  const bk = h('section', { class: 'card' }, h('h2', 'Backup and recovery'), h('p', { class: 'sm muted' }, 'Everything lives on this device first. Export a backup any time; import to restore or move to another device. Imports merge by default and never delete existing history.'));
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; try { const o = JSON.parse(await f.text()); validateBackup(o); const replace = await confirmDialog(`Backup from ${o.exportedAt.slice(0, 10)}: ${o.attempts.length} attempts, ${o.docs.length} documents.\n\nOK = MERGE into your current data (safe). Cancel = choose another option.`, { ok: 'Merge', cancel: 'More options' }); let mode = 'merge'; if (!replace) { if (await confirmDialog('Replace ALL data on this device with this backup? Current local data will be erased (cloud copy, if any, is not touched until the next sync).', { ok: 'Replace everything', cancel: 'Cancel import' })) mode = 'replace'; else { toast('Import cancelled'); return; } } const r = await importBackup(repo, o, mode); toast(`Imported ${r.attempts} attempts, ${r.docs} documents`, 'ok'); ctx.rerender(); } catch (err) { toast('Import failed: ' + err.message); } finally { e.target.value = ''; } } });
  bk.append(h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: async () => { const o = await buildExport(repo); download(`skill-mastery-backup-${dayKey()}.json`, JSON.stringify(o)); await repo.store.setMeta('lastBackup', new Date().toISOString()); toast('Backup downloaded', 'ok'); } }, 'Export backup (JSON)'), h('button', { class: 'btn ghost', onclick: () => file.click() }, 'Import backup'), h('button', { class: 'btn ghost', onclick: async () => { const rows = await repo.store.allAttempts(); const cols = ['client_ts', 'kind', 'context', 'skill_id', 'lesson_id', 'item_id', 'concept', 'score', 'max_score', 'correct', 'complete', 'duration_ms']; const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`; download(`skill-mastery-attempts-${dayKey()}.csv`, [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n'), 'text/csv'); } }, 'Export attempts (CSV)')), file);
  const danger = h('details', { class: 'danger' }, h('summary', 'Danger zone'), h('p', { class: 'sm' }, 'These cannot be undone. Export a backup first.'), h('div', { class: 'row wrap' },
    h('button', { class: 'btn bad', onclick: async () => { if (await confirmDialog('Erase ALL learning data on THIS device? If you are signed in and synced, your cloud copy remains and can be re-downloaded.', { ok: 'Erase local data' })) { await repo.store.clearAll(); await repo.store.setMeta('docSeq', 0); await repo.store.setMeta('attSeq', 0); await repo.load(); toast('Local data erased'); ctx.rerender(); } } }, 'Erase local data'),
    auth.user() ? h('button', { class: 'btn bad', onclick: async () => { if (await confirmDialog('Permanently delete ALL your synced data from the cloud account? Other devices will re-upload their copies on next sync unless you erase them too.', { ok: 'Delete cloud data' })) { try { await ctx.transport.resetRemote(); await repo.store.setMeta('docSeq', 0); await repo.store.setMeta('attSeq', 0); toast('Cloud data deleted'); } catch (e) { toast('Failed: ' + e.message); } } } }, 'Delete cloud data') : null));
  bk.append(danger); root.append(bk);
  // ---- Conflict log
  const cl = h('section', { class: 'card' }, h('h2', 'Sync conflicts')); root.append(cl);
  repo.store.allConflicts().then(cs => { cl.append(h('p', { class: 'sm muted' }, 'When two devices edit the same item offline, the app merges them by a fixed rule and keeps the losing version here so nothing is silently lost.'), cs.length ? cs.slice().reverse().slice(0, 20).map(c => h('details', h('summary', `${new Date(c.at).toLocaleString()} · ${c.kind}/${c.key} · ${c.rule}`), h('pre', JSON.stringify({ kept: c.merged, other: c.lost || c.remote }, null, 2).slice(0, 1500)))) : h('p', { class: 'muted' }, 'No conflicts so far.'), cs.length ? h('button', { class: 'btn ghost sm', onclick: async () => { await repo.store.clearConflicts(); ctx.rerender(); } }, 'Clear log') : null); });
  // ---- How it works
  const how = h('section', { class: 'card' }, h('h2', 'How grading and adaptation work'), h('p', { class: 'muted' }, 'No AI is involved. Everything below is a fixed rule you can read, and you can override any recommendation.'));
  how.append(h('h3', 'Scoring'), h('ul', Object.entries(RULES_TEXT).map(([k, v]) => h('li', h('strong', k + ': '), v))), h('h3', 'Spaced repetition'), h('p', SRS_RULES), h('h3', 'Mastery levels'), h('ul', MASTERY_RULES.map(r => h('li', r))), h('h3', 'Recommendation rules'), h('ul', RULES.map(r => h('li', h('strong', `${r.id} ${r.name}: `), r.text))), h('h3', 'AI-ready, AI-free'), h('p', 'Curriculum, database, grading and history are independent of any AI. A provider interface exists in js/ai/provider.js for the future; in this version no AI service, SDK or key is included, and the active provider is: ', h('strong', listProviders().map(p => p.label).join(', ')), '.'));
  root.append(how, h('p', { class: 'sm muted' }, `Device ${repo.deviceId} · content v${content.version} · ${Object.keys(content.lessons).length} lessons`));
  return { el: root };
}
