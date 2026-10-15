import { CONFIG } from '../config.js';
import { IdbStore } from './store.js';
import { Repo } from './repo.js';
import { Auth } from './auth.js';
import { Syncer, RestTransport } from './sync.js';
import { h, toast, confirmDialog } from './ui/lib.js';
import { todayView, reflectView } from './views/today.js';
import { lessonView } from './views/lesson.js';
import { reviewView, practiceView } from './views/review.js';
import { assessmentView } from './views/assessment.js';
import { abapView } from './views/abap.js';
import { planViewUI } from './views/plan.js';
import { skillsView, skillDetailView, mistakesView } from './views/skills.js';
import { progressView, historyView } from './views/progress.js';
import { settingsView } from './views/settings.js';

const $app = document.getElementById('app'); const $status = document.getElementById('sync-chip'); const $banner = document.getElementById('banner');
function fatal(msg, err) { console.error(err); $app.replaceChildren(h('div', { class: 'view' }, h('h1', 'Something went wrong'), h('p', msg), h('pre', String(err && err.stack || err).slice(0, 800)), h('button', { class: 'btn', onclick: () => location.reload() }, 'Reload'))); }

async function boot() {
  let content;
  try { const res = await fetch('data/content.json'); if (!res.ok) throw new Error('HTTP ' + res.status); content = await res.json(); }
  catch (e) { return fatal('The curriculum could not be loaded. Open the app once while online so it can be saved for offline use.', e); }
  const store = new IdbStore(); try { await store.init(); } catch (e) { return fatal('Local storage (IndexedDB) is unavailable in this browser mode. Private/incognito windows may block it.', e); }
  let deviceId; try { deviceId = localStorage.getItem('sm.device') || ('dev-' + Math.random().toString(36).slice(2, 10)); localStorage.setItem('sm.device', deviceId); } catch { deviceId = 'dev-' + Math.random().toString(36).slice(2, 10); }
  const repo = new Repo(store, { content, deviceId }); await repo.load(); await repo.ensureStartDate();
  const auth = new Auth(CONFIG); const transport = new RestTransport(CONFIG, auth);
  const statusListeners = new Set(); let lastStatus = { state: 'idle' };
  const syncer = new Syncer(repo, transport, { onStatus: s => { lastStatus = s; paintStatus(); statusListeners.forEach(f => f()); } });
  const th = repo.settings().theme; if (th && th !== 'auto') document.documentElement.dataset.theme = th;

  const order = content.curriculum.days.flatMap(d => d.lessons);
  const ctx = { content, repo, auth, syncer, transport, rerender: () => route(), nextLessonAfter: id => { const i = order.indexOf(id); const st = repo.state(); return order.slice(i + 1).find(x => !st.lessons[x].completedAt && st.lessons[x].available) || null; },
    onSyncStatus: (fn, view) => { statusListeners.add(fn); const mo = new MutationObserver(() => { if (!document.contains(view)) { statusListeners.delete(fn); mo.disconnect(); } }); mo.observe(document.body, { childList: true, subtree: true }); },
    afterSignIn: async () => { const u = auth.user(); const prev = await store.getMeta('accountId'); const hasLocal = repo.attempts.length || repo.docs.length;
      if (prev && u && prev !== u.id && hasLocal) { const merge = await confirmDialog('This device holds learning data from a different account. Merge it into the account you just signed in to?', { ok: 'Merge into this account', cancel: 'Keep separate (sign out)' }); if (!merge) { await auth.signOut(); toast('Signed out. Local data untouched.'); return; } }
      if (u) await store.setMeta('accountId', u.id); await trySync(); } };

  function paintStatus() {
    const s = lastStatus; const online = navigator.onLine; let txt, cls;
    if (!auth.user()) { txt = 'Local only'; cls = 'idle'; } else if (!online) { txt = 'Offline'; cls = 'off'; } else if (s.state === 'syncing') { txt = 'Syncing…'; cls = 'busy'; } else if (s.state === 'error') { txt = 'Sync error'; cls = 'err'; } else if (s.state === 'auth') { txt = 'Sign in again'; cls = 'err'; } else if (s.pending && (s.pending.attempts || s.pending.docs)) { txt = `${s.pending.attempts + s.pending.docs} to upload`; cls = 'busy'; } else { txt = 'Synced'; cls = 'ok'; }
    $status.textContent = txt; $status.className = 'chip ' + cls; $status.title = s.error || ''; $banner.hidden = online; $banner.textContent = online ? '' : 'You are offline. Lessons and progress are saved on this device and will sync when you reconnect.';
  }
  let syncTimer = null; const trySync = async () => { if (!auth.user() || !navigator.onLine) { paintStatus(); return; } try { await syncer.sync(); } catch { /* status chip shows it */ } };
  const queueSync = () => { clearTimeout(syncTimer); syncTimer = setTimeout(trySync, 2500); };
  repo.on(() => { if (auth.user()) queueSync(); });
  window.addEventListener('online', () => { paintStatus(); trySync(); }); window.addEventListener('offline', paintStatus);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') trySync(); }); setInterval(() => { if (document.visibilityState === 'visible') trySync(); }, 90000);
  auth.onChange(() => paintStatus());

  // ---- router
  const LIVE = new Set(['today', 'plan', 'skills', 'skill', 'progress', 'mistakes', 'history']); let cur = null, curName = '';
  function parse() { const raw = location.hash.replace(/^#\/?/, '') || 'today'; const [path, q] = raw.split('?'); const parts = path.split('/'); const params = Object.fromEntries(new URLSearchParams(q || '')); return { name: parts[0], arg: parts[1] && decodeURIComponent(parts[1]), params }; }
  function route() {
    const { name, arg, params } = parse(); curName = name; let v;
    try {
      v = name === 'today' ? todayView(ctx) : name === 'reflect' ? reflectView(ctx) : name === 'lesson' ? lessonView(ctx, arg, params) : name === 'review' ? reviewView(ctx) : name === 'practice' ? practiceView(ctx, params) : name === 'assessment' ? assessmentView(ctx, arg, params) : name === 'abap' ? abapView(ctx, arg)
        : name === 'plan' ? planViewUI(ctx) : name === 'skills' ? skillsView(ctx) : name === 'skill' ? skillDetailView(ctx, arg) : name === 'mistakes' ? mistakesView(ctx) : name === 'progress' ? progressView(ctx) : name === 'history' ? historyView(ctx) : name === 'settings' ? settingsView(ctx) : todayView(ctx);
    } catch (e) { return fatal('This screen failed to load.', e); }
    cur = v; $app.replaceChildren(v.el); document.querySelectorAll('nav.main a').forEach(a => a.classList.toggle('on', a.dataset.r === (['skill'].includes(name) ? 'skills' : ['lesson', 'review', 'practice', 'reflect', 'assessment'].includes(name) ? 'today' : name))); window.scrollTo({ top: 0 }); document.title = 'Skill Mastery';
  }
  window.addEventListener('hashchange', route);
  let rt = null; repo.on(() => { if (!LIVE.has(curName)) return; clearTimeout(rt); rt = setTimeout(() => { if (LIVE.has(curName) && !document.activeElement?.matches?.('input,textarea,select')) route(); }, 300); });
  route(); paintStatus(); trySync();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(reg => { reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Update ready: reload to use the latest version'); }); }); }).catch(() => { });
  // backup nudge
  setTimeout(async () => { const lb = await store.getMeta('lastBackup'); if (repo.attempts.length > 40 && !auth.user() && (!lb || Date.now() - Date.parse(lb) > 7 * 864e5)) toast('Tip: export a backup in Settings. You are not signed in, so this device is your only copy.'); }, 4000);
  window.__app = ctx; // for debugging and automated tests
}
boot().catch(e => fatal('The app failed to start.', e));
