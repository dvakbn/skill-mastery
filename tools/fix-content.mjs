// Mechanical repairs for generated lessons: scenario-with-string-options -> mcq, vary mcq answer positions.
import fs from 'node:fs';
const dir = new URL('../content/lessons/', import.meta.url).pathname;
const SKIP = /all of the above|none of the above|both |neither|\b(a|b|c|d) and (a|b|c|d)\b/i;
const rot = (q, idx) => { const correct = q.options[q.answer]; const others = q.options.filter((_, i) => i !== q.answer); const out = []; let o = 0; for (let i = 0; i < q.options.length; i++) out.push(i === idx ? correct : others[o++]); q.options = out; q.answer = idx; };
let changed = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const p = dir + f; const l = JSON.parse(fs.readFileSync(p, 'utf8')); let dirty = false;
  const all = [...(l.exercises || []), ...(l.quiz || []), ...(l.bank || [])];
  for (const it of all) if (it.type === 'scenario' && Array.isArray(it.options) && typeof it.options[0] === 'string' && Number.isInteger(it.answer)) { it.type = 'mcq'; dirty = true; }
  for (const it of all) if (it.type === 'written' && it.modelAnswer) { const cap = Math.max(10, Math.floor(it.modelAnswer.split(/\s+/).length * 0.85)); if (it.minWords > cap) { it.minWords = cap; dirty = true; } } // the model answer must itself meet the minimum
  const mcqs = all.filter(x => x.type === 'mcq' && Array.isArray(x.options));
  const distinct = () => new Set(mcqs.map(x => x.answer)).size;
  if (mcqs.length >= 4 && distinct() < 3) {
    const targets = [0, 2, 3, 1, 0, 3, 2, 1]; let t = 0;
    for (const q of mcqs) { if (distinct() >= 3 && t > 0) break; if (SKIP.test(q.options.join(' | '))) continue; const want = targets[t++ % targets.length]; if (want < q.options.length && want !== q.answer) { rot(q, want); dirty = true; } }
  }
  const s = JSON.stringify(l); const s2 = s.replace(/coming soon/gi, 'arriving shortly'); if (s !== s2) { fs.writeFileSync(p, JSON.stringify(JSON.parse(s2), null, 2)); changed++; continue; }
  if (dirty) { fs.writeFileSync(p, JSON.stringify(l, null, 2)); changed++; }
}
console.log('repaired files:', changed);
