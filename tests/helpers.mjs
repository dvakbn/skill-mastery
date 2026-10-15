import fs from 'node:fs';
export const content = JSON.parse(fs.readFileSync(new URL('../app/data/content.json', import.meta.url), 'utf8'));
let n = 0, failed = 0;
export const test = async (name, fn) => { try { await fn(); n++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n     ', e.stack.split('\n').slice(0, 3).join('\n      ')); } };
export const done = () => { console.log(`\n${n} passed, ${failed} failed`); if (failed) process.exit(1); };
export const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m || 'eq'}: expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
export const ok = (c, m) => { if (!c) throw new Error('assert: ' + m); };
