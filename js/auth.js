// Supabase Auth (GoTrue) over plain fetch. Session lives in localStorage; refreshed automatically.
const KEY = 'sm.session';
export class Auth {
  constructor(cfg) { this.cfg = cfg; this.listeners = new Set(); this.session = this._load(); }
  _load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
  _save(s) { this.session = s; try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { } for (const f of this.listeners) f(s); }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  user() { return this.session && this.session.user; }
  // Where confirmation / reset emails should send the person back to (must also be allowed in Supabase URL Configuration).
  _home() { try { return encodeURIComponent(location.origin + location.pathname.replace(/[^/]*$/, '')); } catch { return ''; } }
  async _call(path, body, token) {
    const res = await fetch(this.cfg.url + path, { method: 'POST', headers: { apikey: this.cfg.anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(j.msg || j.error_description || j.message || j.error || 'Authentication failed'); e.status = res.status; throw e; }
    return j;
  }
  _adopt(j) { const s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)), user: j.user }; this._save(s); return s; }
  async signUp(email, password) {
    const j = await this._call('/auth/v1/signup?redirect_to=' + this._home(), { email, password });
    if (j.access_token) { this._adopt(j); return { signedIn: true }; }
    return { signedIn: false, needsConfirmation: true };
  }
  async signIn(email, password) { const j = await this._call('/auth/v1/token?grant_type=password', { email, password }); this._adopt(j); return { signedIn: true }; }
  async resetPassword(email) { await this._call('/auth/v1/recover?redirect_to=' + this._home(), { email }); }
  async signOut() { const t = this.session && this.session.access_token; this._save(null); if (t) { try { await this._call('/auth/v1/logout', {}, t); } catch { } } }
  async accessToken() {
    const s = this.session; if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    try { const j = await this._call('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token }); return this._adopt(j).access_token; }
    catch (e) { if (e.status === 400 || e.status === 401) this._save(null); throw Object.assign(new Error('Session expired. Please sign in again.'), { code: 'auth' }); }
  }
}
