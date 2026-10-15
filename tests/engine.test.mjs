import { test, done, eq, ok, content } from './helpers.mjs';
import { gradeFill, gradeMcq, gradeScenario, gradeRoleplay, gradeWritten, autoCheck } from '../app/js/engine/grading.js';
import * as SRS from '../app/js/engine/srs.js';
import { derive } from '../app/js/engine/derive.js';
import { planView } from '../app/js/engine/schedule.js';
import { recommend, buildReviewQueue, exercisePlan } from '../app/js/engine/recommend.js';
import { selectAutoItems, scoreAssessment } from '../app/js/engine/assessment.js';
import { addDays } from '../app/js/engine/util.js';
import { uuid } from '../app/js/engine/util.js';

console.log('grading');
await test('mcq right/wrong', () => { eq(gradeMcq({ answer: 2 }, 2).pct, 1); eq(gradeMcq({ answer: 2 }, 1).pct, 0); });
await test('fill normalises case, spaces, punctuation and numbers', () => {
  const it = { accept: ['an, the', '₹1,200'] };
  ok(gradeFill(it, '  An,  THE.').correct, 'case/space/punct'); ok(gradeFill(it, '1200').correct, 'number'); ok(gradeFill(it, 'rs 1,200').correct, 'rs'); ok(!gradeFill(it, '').correct, 'empty');
});
await test('scenario score/3 and correct only at 3', () => { const it = { options: [{ score: 0 }, { score: 3 }, { score: 1 }] }; eq(gradeScenario(it, 2).pct, 1 / 3); ok(gradeScenario(it, 1).correct, 'best'); ok(!gradeScenario(it, 2).correct, 'not best'); });
await test('roleplay totals', () => { const it = { turns: [{ options: [{ score: 3 }, { score: 0 }] }, { options: [{ score: 2 }, { score: 3 }] }, { options: [{ score: 1 }, { score: 3 }] }] }; const r = gradeRoleplay(it, [0, 1, 1]); eq(r.score, 9); eq(r.max, 9); ok(r.correct, 'pass'); eq(gradeRoleplay(it, [1, 0, 0]).pct, 3 / 9); });
const wi = { minWords: 5, rubric: [{ id: 'a', weight: 60, auto: { type: 'forbidden', patterns: ['revert back'], label: 'x' } }, { id: 'b', weight: 40 }] };
await test('written: weighted score, auto-check caps rating at 1, min words, missing ratings', () => {
  let r = gradeWritten(wi, 'we will reply tomorrow about the plan', { a: 3, b: 3 }); eq(r.pct, 1); ok(r.complete, 'complete');
  r = gradeWritten(wi, 'we will revert back tomorrow ok', { a: 3, b: 3 }); ok(r.criteria[0].capped, 'capped'); ok(Math.abs(r.pct - (60 / 3 + 40) / 100) < 1e-9, 'capped pct ' + r.pct);
  r = gradeWritten(wi, 'too short', { a: 3, b: 3 }); ok(r.belowMin && !r.complete, 'incomplete below min');
  r = gradeWritten(wi, 'long enough text for the check here', { a: 3 }); ok(r.missingRatings === 1 && !r.complete, 'missing rating incomplete');
});
await test('autoCheck types', () => { ok(autoCheck({ type: 'keywords', any: ['a', 'b'], min: 2 }, 'A and B').met, 'kw'); ok(!autoCheck({ type: 'minSentences', min: 3 }, 'One. Two.').met, 'sent'); ok(autoCheck({ type: 'regex', pattern: '\\d+' }, 'x 12').met, 'rx'); });

console.log('srs');
await test('intervals grow 1,3,~ease and reset on miss', () => {
  let s = SRS.newState('2026-01-01'); s = SRS.update(s, 4, '2026-01-01'); eq(s.interval, 1); s = SRS.update(s, 4, '2026-01-02'); eq(s.interval, 3); s = SRS.update(s, 4, '2026-01-05'); ok(s.interval >= 7, 'third ' + s.interval);
  const e = s.ease; s = SRS.update(s, 1, '2026-01-12'); eq(s.interval, 1); eq(s.reps, 0); ok(s.ease < e && s.ease >= 1.3, 'ease drops'); eq(s.due, '2026-01-13');
});

// ---------- derivation scenario
const L = Object.values(content.lessons)[0]; const skillId = L.skillId;
const T0 = '2026-03-02';
const at = (day, h = 10) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).toISOString();
const att = (o) => ({ id: uuid(), kind: 'quiz', context: 'lesson', lesson_id: L.id, skill_id: skillId, complete: true, max_score: 1, client_ts: at(T0), answer: {}, ...o });
const lessonDoc = (id, day) => ({ kind: 'lesson', key: id, data: { startedAt: at(day), completedAt: at(day), sections: {} }, version: 1, updated_at: at(day), deleted: false });
console.log('derive');
await test('completion is not mastery: completed lesson without evidence stays Introduced', () => {
  const st = derive({ attempts: [], docs: [lessonDoc(L.id, T0)], content, today: T0 });
  eq(st.mastery[skillId].level, 1); eq(st.mastery[skillId].score, null);
});
await test('items of a completed lesson become due the next day', () => {
  const docs = [lessonDoc(L.id, T0)];
  eq(derive({ attempts: [], docs, content, today: T0 }).dueItems.length, 0);
  const st = derive({ attempts: [], docs, content, today: addDays(T0, 1) }); eq(st.dueItems.length, L.quiz.length + L.bank.length + L.cards.length);
});
await test('Proficient needs delayed retrieval; immediate repeats do not suffice', () => {
  const docs = [lessonDoc(L.id, T0)]; const q = L.quiz[0];
  const mk = (day, kind, n = 1) => Array.from({ length: n }, (_, i) => att({ kind, item_id: q.id, concept: q.concept, score: 1, client_ts: at(day, 9 + i) }));
  let st = derive({ attempts: [...mk(T0, 'quiz', 4), ...mk(T0, 'exercise', 3)], docs, content, today: T0 });
  ok(st.mastery[skillId].level <= 2, 'same-day evidence only ⇒ ≤ Practising, got ' + st.mastery[skillId].level);
  st = derive({ attempts: [...mk(T0, 'quiz', 4), ...mk(addDays(T0, 3), 'review', 2)], docs, content, today: addDays(T0, 3) });
  eq(st.mastery[skillId].level, 3, 'delayed review ⇒ Proficient');
});
await test('Mastered requires ALL lessons of the skill completed', () => {
  const sk = content.skills.find(s => s.id === skillId); const q = L.quiz[0];
  const attempts = []; for (const d of [0, 3, 8, 12]) for (let i = 0; i < 3; i++) attempts.push(att({ kind: d ? 'review' : 'quiz', item_id: q.id, concept: q.concept, score: 1, client_ts: at(addDays(T0, d), 9 + i) }));
  const some = [lessonDoc(L.id, T0)]; let st = derive({ attempts, docs: some, content, today: addDays(T0, 12) });
  ok(st.mastery[skillId].level === 3, 'not all lessons ⇒ Proficient, got ' + st.mastery[skillId].level);
  const all = sk.lessons.map(l => lessonDoc(`${skillId}-${l.n}`, T0)); st = derive({ attempts, docs: all, content, today: addDays(T0, 12) });
  eq(st.mastery[skillId].level, 4, 'all done + sustained ⇒ Mastered');
});
await test('incomplete attempts never count as mastery evidence', () => {
  const q = L.quiz[0]; const st = derive({ attempts: [att({ kind: 'assessment', item_id: q.id, concept: q.concept, score: 1, complete: false })], docs: [lessonDoc(L.id, T0)], content, today: T0 });
  eq(st.mastery[skillId].attempts, 0);
});
await test('recurring mistakes: flagged after 2 misses on 2 days; resolved after 2 correct in a row', () => {
  const q = L.quiz[0]; const mk = (day, ok, h = 10) => att({ kind: 'review', item_id: q.id, concept: q.concept, score: ok ? 1 : 0, client_ts: at(day, h) });
  let st = derive({ attempts: [mk(T0, false), mk(addDays(T0, 2), false)], docs: [], content, today: addDays(T0, 2) });
  eq(st.mistakes[0].status, 'recurring');
  st = derive({ attempts: [mk(T0, false), mk(addDays(T0, 2), false), mk(addDays(T0, 4), true), mk(addDays(T0, 6), true)], docs: [], content, today: addDays(T0, 6) });
  eq(st.mistakes[0].status, 'resolved');
  st = derive({ attempts: [mk(T0, false)], docs: [], content, today: T0 }); eq(st.mistakes[0].status, 'watch');
});
await test('derivation is order-independent (merge-safe) and idempotent', () => {
  const q = L.quiz[0]; const A = [0, 1, 2, 3, 4].map(i => att({ kind: 'review', item_id: q.id, concept: q.concept, score: i % 2, client_ts: at(addDays(T0, i)) }));
  const a = derive({ attempts: A, docs: [], content, today: addDays(T0, 5) }), b = derive({ attempts: [...A].reverse().concat(A), docs: [], content, today: addDays(T0, 5) });
  eq([...a.srs.get(q.id).due, a.srs.get(q.id).interval].join(), [...b.srs.get(q.id).due, b.srs.get(q.id).interval].join());
});
await test('same-day correct repeats do not inflate the interval', () => {
  const q = L.quiz[0]; const A = [0, 1, 2, 3].map(i => att({ kind: 'review', item_id: q.id, concept: q.concept, score: 1, client_ts: at(T0, 8 + i) }));
  eq(derive({ attempts: A, docs: [], content, today: T0 }).srs.get(q.id).interval, 1);
});

console.log('schedule + recommendations');
const sett = { startDate: T0, reviewCap: 12 };
await test('plan slides forward when behind; never loses days', () => {
  const st = derive({ attempts: [], docs: [], content, today: addDays(T0, 4) }); const p = planView(content, st, sett, addDays(T0, 4));
  eq(p.activeDay, 1); eq(p.behind, 4); eq(p.rows[0].projected, addDays(T0, 4)); eq(p.rows[1].projected, addDays(T0, 5)); eq(p.shift, 4);
});
await test('catch-up rule fires at ≥2 days behind and offers lighter load at ≥3', () => {
  const t = addDays(T0, 4); const st = derive({ attempts: [], docs: [], content, today: t }); const p = planView(content, st, sett, t);
  const r = recommend({ content, st, plan: p, settings: sett, today: t }).find(x => x.rule === 'R6'); ok(r && r.lightLoad, 'R6');
});
await test('due reviews recommend a session; dismissal is respected', () => {
  const docs = [lessonDoc(L.id, T0)]; const t = addDays(T0, 2); const st = derive({ attempts: [], docs, content, today: t }); const p = planView(content, st, sett, t);
  let recs = recommend({ content, st, plan: p, settings: sett, today: t }); const r1 = recs.find(r => r.rule === 'R1'); ok(r1, 'R1 present');
  recs = recommend({ content, st, plan: p, settings: sett, overrides: { [r1.id]: { state: 'dismissed' } }, today: t }); ok(!recs.find(r => r.rule === 'R1'), 'dismissed');
});
await test('review queue caps at reviewCap and prioritises overdue', () => {
  const docs = content.skills.flatMap(s => s.lessons.map(l => `${s.id}-${l.n}`)).filter(id => content.lessons[id]).map(id => lessonDoc(id, T0));
  const t = addDays(T0, 10); const st = derive({ attempts: [], docs, content, today: t }); const q = buildReviewQueue(st, { reviewCap: 12 }, t);
  eq(q.queue.length, 12); ok(q.backlog > 0, 'backlog'); ok(q.total === st.dueItems.length, 'total');
});
await test('difficulty progression: stretch unlocked by high mastery, hints expanded when struggling', () => {
  eq(exercisePlan(L, { score: 0.9, level: 3, mass: 5 }, {}).stretch, 'recommended');
  const w = exercisePlan(L, { score: 0.4, level: 2, mass: 5 }, {}); ok(w.support && w.stretch === 'discouraged', 'support');
  eq(exercisePlan(L, null, {}).stretch, 'optional'); eq(exercisePlan(L, { score: 0.9, level: 3, mass: 5 }, { difficulty: 'easier' }).stretch, 'optional');
});
console.log('assessment');
await test('selection is deterministic, covers each skill, and only uses completed lessons', () => {
  const ids = Object.keys(content.lessons).filter(i => i.startsWith('english') || i.startsWith('reading'));
  const docs = ids.map(i => lessonDoc(i, T0)); const st = derive({ attempts: [], docs, content, today: addDays(T0, 5) });
  const def = { id: 'week-1', coverage: ['english', 'reading'] };
  const a = selectAutoItems(content, st, def, 'run1'), b = selectAutoItems(content, st, def, 'run1'); eq(a, b); ok(a.length === 12 || a.length > 6, 'count ' + a.length);
  const skills = new Set(a.map(id => id.replace(/-\d.*/, ''))); ok(skills.has('english') && skills.has('reading'), 'coverage');
  ok(a.every(id => st.lessons[id.split('.')[0]].completedAt), 'only completed lessons');
});
await test('scoring: weights 50/20/30; incomplete never passes; pass mark 70', () => {
  const base = { def: {}, autoExpected: 4, auto: [1, 1, 1, 1].map(p => ({ pct: p, skillId: 'a' })), applied: [{ type: 'scenario', pct: 1, answered: true, skills: ['a'] }, { type: 'written', pct: 1, answered: true, complete: true, skills: ['a'] }] };
  let r = scoreAssessment(base); eq(r.pct, 1); ok(r.passed, 'pass');
  r = scoreAssessment({ ...base, auto: base.auto.slice(0, 3) }); ok(!r.complete && !r.passed, 'missing item ⇒ incomplete, never passes');
  r = scoreAssessment({ ...base, applied: [{ type: 'scenario', pct: 0, answered: true, skills: ['a'] }, { type: 'written', pct: 0, answered: true, complete: true, skills: ['a'] }] }); ok(Math.abs(r.pct - 0.5) < 1e-9 && !r.passed, 'half ⇒ 50% fail');
});
done();
