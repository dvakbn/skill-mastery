// Builds app/data/abap-course.json from days/*.mjs and plan.mjs. Run: node tools/abap/course.mjs
import { writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { phases, plan } from './plan.mjs';
const here = new URL('.', import.meta.url);
const files = readdirSync(fileURLToPath(new URL('days/', here))).filter(f => /^d\d+\.mjs$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
const days = []; for (const f of files) days.push((await import('./days/' + f)).default);
const errs = []; const bad = m => errs.push(m);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const tags = {}, questions = {}, outDays = [];
for (const d of days) for (const [id, t] of Object.entries(d.tags)) { if (tags[id]) bad('dup tag ' + id); tags[id] = { day: d.n, title: t.title, reteach: t.reteach, extra: t.extra }; }
const pos = [0, 0, 0, 0];
for (const d of days) {
  const ids = { quiz: [], retest: [] };
  for (const bank of ['quiz', 'retest']) d[bank].forEach((q, i) => {
    const id = `d${d.n}.${bank === 'quiz' ? 'q' : 'r'}${i + 1}`;
    if (!tags[q.tag]) bad(id + ': unknown tag ' + q.tag);
    const all = [q.right, ...q.wrong]; if (all.length !== 4 || new Set(all).size !== 4) bad(id + ': need 4 distinct options');
    if (q.why.split(/\s+/).length < 8) bad(id + ': why too short');
    const r = rng(hash(id)); const o = all.map(t => ({ t, c: t === q.right })); for (let k = 3; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; }
    const answer = o.findIndex(x => x.c); pos[answer]++;
    questions[id] = { day: d.n, bank, tag: q.tag, prompt: q.prompt, options: o.map(x => x.t), answer, why: q.why }; ids[bank].push(id);
  });
  if (!d.checkpoint) for (const t of Object.keys(d.tags)) { for (const b of ['quiz', 'retest']) if (!ids[b].some(id => questions[id].tag === t)) bad(`d${d.n}: tag ${t} missing from ${b}`); }
  if (d.checkpoint && d.quiz.length < 12) bad('checkpoint needs 12 quiz questions');
  const { tags: _t, quiz: _q, retest: _r, ...rest } = d;
  outDays.push({ ...rest, tagIds: Object.keys(d.tags), quiz: ids.quiz, retest: ids.retest, gate: d.gate || 0.7 });
}
for (const [id, t] of Object.entries(tags)) if (t.reteach.split(/\s+/).length < 30) bad(id + ': reteach too short');
const share = Math.max(...pos) / pos.reduce((a, b) => a + b, 0); if (share > 0.4) bad('answer positions skewed ' + pos);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
const out = { version: 1, title: 'SAP ABAP 30-day course', minutesPerDay: 60, phases, plan, built: outDays.map(d => d.n), tags, days: outDays, questions };
writeFileSync(fileURLToPath(new URL('../../app/data/abap-course.json', here)), JSON.stringify(out).replace(/§/g, '`'));
console.log(`days ${outDays.length}, tags ${Object.keys(tags).length}, questions ${Object.keys(questions).length}, answer positions ${pos}`);
