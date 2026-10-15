// Local persistence. IdbStore (browser, IndexedDB) and MemoryStore (tests) share one async API.
const DB = 'skill-mastery', VER = 1;
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export class IdbStore {
  async init() {
    this.db = await new Promise((res, rej) => {
      const o = indexedDB.open(DB, VER);
      o.onupgradeneeded = () => { const d = o.result;
        const a = d.createObjectStore('attempts', { keyPath: 'id' }); a.createIndex('synced', 'synced');
        const c = d.createObjectStore('docs', { keyPath: 'id' }); c.createIndex('dirty', 'dirty');
        d.createObjectStore('meta', { keyPath: 'key' }); d.createObjectStore('conflicts', { keyPath: 'cid', autoIncrement: true }); };
      o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error);
    });
  }
  tx(names, mode = 'readonly') { const t = this.db.transaction(names, mode); return names.length ? names.map(n => t.objectStore(n)) : []; }
  async putAttempt(a) { const [s] = this.tx(['attempts'], 'readwrite'); await req(s.put({ ...a, synced: a.synced ? 1 : 0 })); }
  async addAttemptIfMissing(a) { const [s] = this.tx(['attempts'], 'readwrite'); const ex = await req(s.get(a.id)); if (ex) return false; await req(s.put({ ...a, synced: 1 })); return true; }
  async allAttempts() { const [s] = this.tx(['attempts']); return (await req(s.getAll())).map(({ synced, ...r }) => r); }
  async unsyncedAttempts(limit = 200) { const [s] = this.tx(['attempts']); return (await req(s.index('synced').getAll(0, limit))).map(({ synced, ...r }) => r); }
  async countUnsyncedAttempts() { const [s] = this.tx(['attempts']); return req(s.index('synced').count(0)); }
  async markSynced(ids) { const [s] = this.tx(['attempts'], 'readwrite'); for (const id of ids) { const r = await req(s.get(id)); if (r) { r.synced = 1; await req(s.put(r)); } } }
  async getDoc(kind, key) { const [s] = this.tx(['docs']); const r = await req(s.get(kind + '/' + key)); return r ? strip(r) : undefined; }
  async allDocs() { const [s] = this.tx(['docs']); return (await req(s.getAll())).map(strip); }
  async putDoc(d) { const [s] = this.tx(['docs'], 'readwrite'); await req(s.put({ ...d, id: d.kind + '/' + d.key, dirty: d.dirty ? 1 : 0 })); }
  async dirtyDocs() { const [s] = this.tx(['docs']); return (await req(s.index('dirty').getAll(1))).map(strip); }
  async getMeta(k) { const [s] = this.tx(['meta']); const r = await req(s.get(k)); return r ? r.value : undefined; }
  async setMeta(k, v) { const [s] = this.tx(['meta'], 'readwrite'); await req(s.put({ key: k, value: v })); }
  async addConflict(c) { const [s] = this.tx(['conflicts'], 'readwrite'); await req(s.add(c)); }
  async allConflicts() { const [s] = this.tx(['conflicts']); return req(s.getAll()); }
  async clearConflicts() { const [s] = this.tx(['conflicts'], 'readwrite'); await req(s.clear()); }
  async clearAll() { for (const n of ['attempts', 'docs', 'conflicts']) { const [s] = this.tx([n], 'readwrite'); await req(s.clear()); } }
}
const strip = ({ id, dirty, ...r }) => ({ ...r, dirty: !!dirty });
export class MemoryStore {
  async init() { this.a = new Map(); this.d = new Map(); this.m = new Map(); this.c = []; }
  async putAttempt(a) { this.a.set(a.id, { ...a, synced: !!a.synced }); }
  async addAttemptIfMissing(a) { if (this.a.has(a.id)) return false; this.a.set(a.id, { ...a, synced: true }); return true; }
  async allAttempts() { return [...this.a.values()].map(({ synced, ...r }) => ({ ...r })); }
  async unsyncedAttempts(limit = 200) { return [...this.a.values()].filter(x => !x.synced).slice(0, limit).map(({ synced, ...r }) => ({ ...r })); }
  async countUnsyncedAttempts() { return [...this.a.values()].filter(x => !x.synced).length; }
  async markSynced(ids) { for (const id of ids) { const r = this.a.get(id); if (r) r.synced = true; } }
  async getDoc(k, key) { const r = this.d.get(k + '/' + key); return r ? JSON.parse(JSON.stringify(r)) : undefined; }
  async allDocs() { return [...this.d.values()].map(r => JSON.parse(JSON.stringify(r))); }
  async putDoc(d) { this.d.set(d.kind + '/' + d.key, JSON.parse(JSON.stringify({ ...d, dirty: !!d.dirty }))); }
  async dirtyDocs() { return [...this.d.values()].filter(x => x.dirty).map(r => JSON.parse(JSON.stringify(r))); }
  async getMeta(k) { return this.m.get(k); }
  async setMeta(k, v) { this.m.set(k, v); }
  async addConflict(c) { this.c.push({ ...c, cid: this.c.length + 1 }); }
  async allConflicts() { return this.c.slice(); }
  async clearConflicts() { this.c = []; }
  async clearAll() { this.a.clear(); this.d.clear(); this.c = []; }
}
