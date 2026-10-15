import fs from 'node:fs';
import { scoreDiagnostic, summaryText, statusOf, DONT_KNOW } from '../app/js/engine/abap.js';
const bank = JSON.parse(fs.readFileSync(new URL('../app/data/abap-diagnostic.json', import.meta.url), 'utf8'));
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('  ✓', n); } catch (e) { fail++; console.log('  ✗', n, '\n   ', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ` expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const all = f => Object.fromEntries(bank.questions.map(q => [q.id, { choice: f(q) }]));
console.log('abap diagnostic');
t('bank is well-formed: 43 questions, 8 topics, each question has 4 distinct options and a valid answer', () => {
  eq(bank.questions.length, 43); eq(bank.topics.length, 8);
  for (const q of bank.questions) { eq(new Set(q.options).size, 4, q.id); if (!(q.answer >= 0 && q.answer < 4)) throw new Error(q.id); if (!bank.topics.some(x => x.id === q.topic)) throw new Error(q.id + ' topic'); }
  eq(new Set(bank.questions.map(q => q.id)).size, 43);
});
t('all correct = 100%, every topic strong, ceiling is level 3, nothing missed', () => { const r = scoreDiagnostic(bank, all(q => q.answer)); eq(r.overall.pct, 1); eq(r.byTopic.every(x => x.status === 'strong'), true); eq(r.ceiling, 3); eq(r.missed.length, 0); eq(r.complete, true); });
t('all "I don\'t know" = 0%, everything counted as gaps (not misconceptions)', () => { const r = scoreDiagnostic(bank, all(() => DONT_KNOW)); eq(r.overall.correct, 0); eq(r.overall.gap, 43); eq(r.overall.misconception, 0); eq(r.ceiling, 0); });
t('wrong answers are misconceptions, distinct from gaps and skipped', () => {
  const a = {}; bank.questions.slice(0, 3).forEach((q, i) => { a[q.id] = { choice: i === 0 ? (q.answer + 1) % 4 : i === 1 ? DONT_KNOW : q.answer }; });
  const r = scoreDiagnostic(bank, a); eq([r.overall.misconception, r.overall.gap, r.overall.correct, r.overall.skipped], [1, 1, 1, 40]); eq(r.complete, false); eq(r.answered, 3);
});
t('status thresholds: 80% strong, 50% developing, below weak', () => { eq([statusOf(0.8), statusOf(0.79), statusOf(0.5), statusOf(0.49)], ['strong', 'developing', 'developing', 'weak']); });
t('ceiling needs 60% at a level and stops at the first level below it', () => {
  const a = all(q => q.level === 3 ? DONT_KNOW : q.answer); eq(scoreDiagnostic(bank, a).ceiling, 2);
  const b = all(q => q.level === 1 ? DONT_KNOW : q.answer); eq(scoreDiagnostic(bank, b).ceiling, 0, 'weak level 1 caps everything');
});
t('per-topic scoring isolates one weak topic', () => { const r = scoreDiagnostic(bank, all(q => q.topic === 'sql' ? DONT_KNOW : q.answer)); eq(r.byTopic.find(x => x.id === 'sql').status, 'weak'); eq(r.byTopic.filter(x => x.status === 'strong').length, 7); eq(r.missed.every(m => m.topic === 'sql'), true); });
t('summary text lists weakest topic first and names missed concepts', () => { const r = scoreDiagnostic(bank, all(q => q.topic === 'itab' ? DONT_KNOW : q.answer)); const s = summaryText(bank, r, '2026-10-15'); eq(s.split('\n')[3].includes('Internal tables'), true, 'weakest first'); eq(s.includes('APPEND'), true); });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
