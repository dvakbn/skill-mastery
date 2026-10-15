// Repository: the single write path used by the UI. Keeps an in-memory mirror for fast derivation.
import { uuid, dayKey } from './engine/util.js';
import { derive } from './engine/derive.js';

// Deterministic UUID-shaped id from a string (so the same event on two devices is one attempt).
export function detId(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x7f4a7c15;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); h3 = Math.imul(h3 ^ c, 2246822507); h4 = Math.imul(h4 ^ c, 3266489909); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909); h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  const hex = n => (n >>> 0).toString(16).padStart(8, '0'); const s = hex(h1) + hex(h2) + hex(h3) + hex(h4);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}
export const DEFAULT_SETTINGS = { startDate: null, reviewCap: 12, difficulty: 'auto', theme: 'auto', reminder: '20:30', lightLoad: false };

export class Repo {
  constructor(store, { content, deviceId } = {}) { this.store = store; this.content = content; this.deviceId = deviceId || 'dev-' + uuid().slice(0, 8); this.listeners = new Set(); this.attempts = []; this.docs = []; this._st = null; }
  async load() { this.attempts = await this.store.allAttempts(); this.docs = await this.store.allDocs(); this._st = null; this.emit(); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this._st = null; for (const f of this.listeners) try { f(); } catch (e) { console.error(e); } }
  state(today = dayKey()) { if (!this._st || this._st.today !== today) this._st = derive({ attempts: this.attempts, docs: this.docs, content: this.content, today }); return this._st; }
  async recordAttempt(p) {
    const a = { id: p.id || uuid(), kind: p.kind, context: p.context || 'lesson', lesson_id: p.lesson_id || null, item_id: p.item_id || null, skill_id: p.skill_id || null, concept: p.concept || null, answer: p.answer || {}, score: p.score, max_score: p.max_score ?? 1, correct: p.correct ?? null, complete: p.complete !== false, duration_ms: p.duration_ms ?? null, client_ts: p.client_ts || new Date().toISOString(), device_id: this.deviceId };
    if (this.attempts.some(x => x.id === a.id)) return a; // idempotent
    await this.store.putAttempt({ ...a, synced: false }); this.attempts.push(a); this.emit(); return a;
  }
  getDoc(kind, key) { return this.docs.find(d => d.kind === kind && d.key === key && !d.deleted); }
  async saveDoc(kind, key, data, extra = {}) {
    const prev = await this.store.getDoc(kind, key);
    const d = { kind, key, data, version: prev ? prev.version : 0, updated_at: new Date().toISOString(), deleted: !!extra.deleted, dirty: true, device_id: this.deviceId };
    await this.store.putDoc(d); this.docs = this.docs.filter(x => !(x.kind === kind && x.key === key)); this.docs.push(d); this.emit(); return d;
  }
  async updateDoc(kind, key, fn, init = {}) { const cur = this.getDoc(kind, key); const next = fn(cur ? JSON.parse(JSON.stringify(cur.data)) : JSON.parse(JSON.stringify(init))); return this.saveDoc(kind, key, next); }
  settings() { const d = this.getDoc('settings', 'main'); return { ...DEFAULT_SETTINGS, ...((d && d.data.v) || {}) }; }
  async setSetting(k, v) { return this.updateDoc('settings', 'main', s => { s.v[k] = v; s.ts[k] = Date.now(); return s; }, { v: {}, ts: {} }); }
  async ensureStartDate() { if (!this.settings().startDate) await this.setSetting('startDate', dayKey()); }
  async reloadFromStore() { await this.load(); }
}
