// Offline-first service worker: precaches the app shell and curriculum; network-first for data so updates arrive.
const VERSION = 'sm-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'config.js', 'data/content.json',
  'js/main.js', 'js/store.js', 'js/repo.js', 'js/sync.js', 'js/merge.js', 'js/auth.js', 'js/ai/provider.js',
  'js/engine/util.js', 'js/engine/grading.js', 'js/engine/srs.js', 'js/engine/derive.js', 'js/engine/schedule.js', 'js/engine/recommend.js', 'js/engine/assessment.js',
  'js/ui/lib.js', 'js/ui/items.js', 'js/views/today.js', 'js/views/lesson.js', 'js/views/review.js', 'js/views/assessment.js', 'js/views/plan.js', 'js/views/skills.js', 'js/views/progress.js', 'js/views/settings.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // never cache API calls (Supabase is cross-origin)
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
    catch { const hit = await cache.match(req, { ignoreSearch: true }); if (hit) return hit; if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error(); return Response.error(); }
  })());
});
