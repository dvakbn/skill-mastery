// Small shared helpers (pure, no DOM).
export const uuid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const pad = n => String(n).padStart(2, '0');
// Local calendar day key YYYY-MM-DD
export const dayKey = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
export const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000); // b - a
export const words = s => (String(s || '').trim().match(/\S+/g) || []).length;
export function normalize(s) {
  return String(s ?? '').toLowerCase().normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ').replace(/[\s.!?;:]+$/g, '').trim();
}
// Deterministic PRNG (mulberry32) seeded from a string
export function rng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (let i = 0; i < String(seed).length; i++) { h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(arr, seed) { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const sum = a => a.reduce((x, y) => x + y, 0);
export const avg = a => a.length ? sum(a) / a.length : 0;
export const by = (k) => (a, b) => a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0;
