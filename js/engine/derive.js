// Derives ALL learner state from immutable attempts + mutable docs. Pure and deterministic:
// two devices holding the same attempts/docs always compute identical state.
import { dayKey, addDays, daysBetween, avg, sum } from './util.js';
import { PASS, qualityOf } from './grading.js';
import * as SRS from './srs.js';

export const LEVELS = ['Not started', 'Introduced', 'Practising', 'Proficient', 'Mastered'];
export const KIND_WEIGHT = { quiz: 1.0, exercise: 1.0, review: 1.2, card: 0.6, assessment: 1.6, roleplay: 1.0, written: 0.8 };
export const MASTERY_RULES = [
  'Evidence = scored attempts (quizzes, exercises, reviews, flashcards, assessments). Tasks and reflections prove completion, not mastery.',
  'Each attempt is weighted: assessment 1.6, review 1.2, quiz/exercise 1.0, self-graded written 0.8, flashcard 0.6, and halves in weight every 21 days.',
  'Mastery score = weighted average of attempt scores. Level 2 Practising: score ≥ 60% with enough evidence (weight ≥ 3).',
  'Level 3 Proficient: score ≥ 75%, evidence on ≥ 2 different days, and ≥ 1 successful retrieval (≥ 70%) at least 2 days after the lesson.',
  'Level 4 Mastered: score ≥ 85%, evidence on ≥ 3 days spanning ≥ 7 days, ≥ 2 successful delayed retrievals (≥ 3 days after the lesson), no unresolved recurring mistakes, and all lessons of the skill completed.',
  'Completion and mastery are separate: finishing every lesson does not raise your level without demonstrated, delayed performance.'
];

const memo = new WeakMap();
export function indexContent(content) {
  if (memo.has(content)) return memo.get(content);
  const items = new Map(); const conceptInfo = new Map();
  for (const l of Object.values(content.lessons)) {
    l.concepts.forEach(c => conceptInfo.set(c.id, { label: c.label, lessonId: l.id, skillId: l.skillId }));
    const add = (it, pool) => items.set(it.id, { item: it, lessonId: l.id, skillId: l.skillId, pool });
    l.quiz.forEach(i => add(i, 'quiz')); l.bank.forEach(i => add(i, 'bank')); l.exercises.forEach(i => add(i, 'exercise'));
    l.cards.forEach(c => items.set(c.id, { item: c, lessonId: l.id, skillId: l.skillId, pool: 'card' }));
  }
  for (const a of Object.values(content.assessments || {})) (a.concepts || []).forEach(c => conceptInfo.set(c.id, { label: c.label, lessonId: null, skillId: c.id.split('.')[0] }));
  const idx = { items, conceptInfo }; memo.set(content, idx); return idx;
}
const attemptDay = a => dayKey(new Date(a.client_ts));
const pct = a => a.max_score ? a.score / a.max_score : 0;
const isSRSPool = p => p === 'quiz' || p === 'bank' || p === 'card';

export function derive({ attempts, docs, content, today = dayKey() }) {
  const idx = indexContent(content);
  const sorted = attempts.slice().sort((a, b) => a.client_ts < b.client_ts ? -1 : a.client_ts > b.client_ts ? 1 : a.id < b.id ? -1 : 1);
  const docMap = new Map(); for (const d of docs) if (!d.deleted) docMap.set(d.kind + '/' + d.key, d.data);
  const getDoc = (k, key) => docMap.get(k + '/' + key);

  // ---- lesson progress
  const lessons = {}; let completedLessons = 0;
  for (const id of Object.keys(content.curriculum.lessonDay)) {
    const l = { id, skillId: id.replace(/-\d+$/, '') };
    const p = getDoc('lesson', l.id) || {}; const task = getDoc('task', l.id) || {};
    const done = !!p.completedAt;
    lessons[l.id] = { id: l.id, skillId: l.skillId, available: !!content.lessons[id], started: !!p.startedAt, completedAt: p.completedAt || null, completedDay: p.completedAt ? dayKey(new Date(p.completedAt)) : null, sections: p.sections || {}, taskDone: !!task.completedAt };
    if (done) completedLessons++;
  }

  // ---- SRS replay
  const srs = new Map();
  for (const a of sorted) {
    const info = a.item_id && idx.items.get(a.item_id); if (!info || !isSRSPool(info.pool)) continue;
    if (a.kind === 'task' || a.kind === 'reflection') continue;
    const day = attemptDay(a); let st = srs.get(a.item_id) || SRS.newState(day);
    const q = info.pool === 'card' ? (a.answer && a.answer.quality != null ? a.answer.quality : (pct(a) >= PASS ? 4 : 1)) : qualityOf({ pct: pct(a) }, a.kind);
    if (st.last === day && q >= 3 && st.reps > 0) { srs.set(a.item_id, { ...st, seen: st.seen + 1 }); continue; }
    srs.set(a.item_id, SRS.update(st, q, day));
  }
  for (const l of Object.values(lessons)) if (l.completedDay) {
    const L = content.lessons[l.id]; if (!L) continue;
    for (const it of [...L.quiz, ...L.bank, ...L.cards]) if (!srs.has(it.id)) srs.set(it.id, SRS.newState(addDays(l.completedDay, 1)));
  }
  const dueItems = [];
  for (const [id, st] of srs) { const info = idx.items.get(id); if (!info || !lessons[info.lessonId].completedDay) continue; if (st.due <= today) dueItems.push({ id, ...info, st, overdue: daysBetween(st.due, today) }); }

  // ---- mistakes (per concept)
  const mm = new Map();
  for (const a of sorted) {
    if (!a.concept || a.kind === 'task' || a.kind === 'reflection' || (a.answer && a.answer.summary)) continue;
    let m = mm.get(a.concept); const ci = idx.conceptInfo.get(a.concept);
    if (!m) mm.set(a.concept, m = { concept: a.concept, label: ci ? ci.label : a.concept, skillId: a.skill_id || (ci && ci.skillId), lessonId: ci && ci.lessonId, log: [] });
    m.log.push({ ts: a.client_ts, day: attemptDay(a), ok: pct(a) >= PASS });
  }
  const mistakes = [];
  for (const m of mm.values()) {
    const misses = m.log.filter(x => !x.ok); if (!misses.length) continue;
    let tail = 0; for (let i = m.log.length - 1; i >= 0 && m.log[i].ok; i--) tail++;
    const missDays = new Set(misses.map(x => x.day)).size;
    const unresolved = tail < 2;
    const status = !unresolved ? 'resolved' : (misses.length >= 2 && (missDays >= 2 || misses.length >= 3)) ? 'recurring' : 'watch';
    const last = misses[misses.length - 1].day;
    mistakes.push({ ...m, misses: misses.length, missDays, attempts: m.log.length, lastMiss: last, correctStreak: tail, status, severity: misses.length * Math.pow(0.5, Math.max(0, daysBetween(last, today)) / 14) });
  }
  mistakes.sort((a, b) => (b.status === 'recurring') - (a.status === 'recurring') || b.severity - a.severity);

  // ---- mastery per skill
  const mastery = {};
  const lessonDayOf = id => lessons[id] && lessons[id].completedDay;
  for (const s of content.skills) {
    const total = s.lessons.length; const done = s.lessons.filter(l => lessons[`${s.id}-${l.n}`].completedAt).length;
    const ev = sorted.filter(a => a.skill_id === s.id && a.complete !== false && ['quiz', 'exercise', 'review', 'card', 'assessment', 'roleplay', 'written'].includes(a.kind) && !(a.answer && a.answer.summary));
    let W = 0, S = 0; const days = new Set(); const delayed2 = new Set(), delayed3 = new Set(); let assessOk = false;
    for (const a of ev) {
      const age = Math.max(0, daysBetween(attemptDay(a), today)); const w = (KIND_WEIGHT[a.kind] || 1) * Math.pow(0.5, age / 21);
      W += w; S += w * pct(a); days.add(attemptDay(a));
      if ((a.kind === 'review' || a.kind === 'assessment') && pct(a) >= PASS) {
        const ld = lessonDayOf(a.lesson_id);
        const gap = ld ? daysBetween(ld, attemptDay(a)) : 0;
        if (gap >= 2) delayed2.add(attemptDay(a) + a.item_id); if (gap >= 3) delayed3.add(attemptDay(a) + a.item_id);
        if (a.kind === 'assessment') assessOk = true;
      }
    }
    const score = W > 0 ? S / W : null; const dayList = [...days].sort(); const span = dayList.length ? daysBetween(dayList[0], dayList[dayList.length - 1]) : 0;
    const recurring = mistakes.filter(m => m.skillId === s.id && m.status === 'recurring').length;
    const c = {
      l1: done >= 1, l2: W >= 3 && score !== null && score >= 0.6,
      l3: score !== null && score >= 0.75 && days.size >= 2 && delayed2.size >= 1,
      l4: score !== null && score >= 0.85 && days.size >= 3 && span >= 7 && delayed3.size >= 2 && recurring === 0 && done === total
    };
    let level = 0; if (c.l1) level = 1; if (c.l1 && c.l2) level = 2; if (level >= 2 && c.l3) level = 3; if (level >= 3 && c.l4) level = 4;
    const need = [];
    const chk = (ok, txt) => need.push({ ok, text: txt });
    if (level < 1) chk(false, 'Complete a lesson of this skill');
    else if (level === 1) { chk(W >= 3, `Evidence weight ≥ 3 (now ${W.toFixed(1)})`); chk(score !== null && score >= 0.6, `Score ≥ 60% (now ${score === null ? '—' : Math.round(score * 100) + '%'})`); }
    else if (level === 2) { chk(score >= 0.75, `Score ≥ 75% (now ${Math.round(score * 100)}%)`); chk(days.size >= 2, `Evidence on ≥ 2 days (now ${days.size})`); chk(delayed2.size >= 1, `A successful retrieval ≥ 2 days after the lesson (now ${delayed2.size})`); }
    else if (level === 3) { chk(score >= 0.85, `Score ≥ 85% (now ${Math.round(score * 100)}%)`); chk(days.size >= 3 && span >= 7, `Evidence on ≥ 3 days over ≥ 7 days (now ${days.size} days / ${span})`); chk(delayed3.size >= 2, `≥ 2 successful retrievals ≥ 3 days after the lesson (now ${delayed3.size})`); chk(recurring === 0, 'No unresolved recurring mistakes'); chk(done === total, `All ${total} lessons completed (now ${done})`); }
    // trend: last 14 days vs previous 14
    const win = (from, to) => { const xs = ev.filter(a => { const g = daysBetween(attemptDay(a), today); return g >= from && g < to; }).map(pct); return xs.length ? avg(xs) : null; };
    const recent = win(0, 14), prev = win(14, 28);
    mastery[s.id] = { skillId: s.id, total, done, completion: done / total, score, mass: W, level, levelName: LEVELS[level], evidenceDays: days.size, delayedSuccesses: delayed2.size, needs: need, recurring, recent, prev, trend: recent !== null && prev !== null ? recent - prev : null, lastEvidence: dayList.length ? dayList[dayList.length - 1] : null, attempts: ev.length };
  }

  // ---- activity
  const activeDays = new Map();
  for (const a of sorted) if (a.complete !== false || a.kind === 'task' || a.kind === 'reflection') { const d = attemptDay(a); const r = activeDays.get(d) || { n: 0, ms: 0 }; r.n++; r.ms += Math.min(a.duration_ms || 0, 600000); activeDays.set(d, r); }
  let streak = 0, best = 0, run = 0; { const keys = [...activeDays.keys()].sort(); let prev = null; for (const k of keys) { run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; }
    let d = activeDays.has(today) ? today : addDays(today, -1); while (activeDays.has(d)) { streak++; d = addDays(d, -1); } }

  const reviewsDone = sorted.filter(a => a.kind === 'review' || a.kind === 'card').length;
  const asmt = Object.values(getAssessmentRuns(docs)).filter(r => r.status === 'submitted').sort((a, b) => a.submittedAt < b.submittedAt ? -1 : 1);
  const stats = { completedLessons, totalLessons: Object.keys(content.lessons).length, attempts: sorted.length, reviewsDone, streak, bestStreak: best, activeDays: activeDays.size, due: dueItems.length };
  const skillsAt = n => content.skills.filter(s => mastery[s.id].level >= n).length;
  const milestones = [
    ['First lesson completed', completedLessons >= 1], ['10 lessons completed', completedLessons >= 10], ['25 lessons completed', completedLessons >= 25], ['50 lessons completed', completedLessons >= 50], ['All lessons completed', completedLessons >= stats.totalLessons],
    ['3-day streak', best >= 3], ['7-day streak', best >= 7], ['30-day streak', best >= 30],
    ['100 spaced reviews', reviewsDone >= 100], ['First skill Proficient', skillsAt(3) >= 1], ['5 skills Proficient', skillsAt(3) >= 5], ['13 skills Proficient', skillsAt(3) >= 13], ['First skill Mastered', skillsAt(4) >= 1], ['10 skills Mastered', skillsAt(4) >= 10],
    ['First weekly assessment passed', asmt.some(r => r.result && r.result.passed && r.defId.startsWith('week-'))], ['All 8 weekly assessments passed', content.curriculum.days.filter(d => d.type === 'assessment').every(d => asmt.some(r => r.defId === d.assessment && r.result.passed))],
    ['First recurring mistake resolved', mistakes.some(m => m.status === 'resolved' && m.misses >= 2)], ['Final assessment passed', asmt.some(r => r.defId === 'final' && r.result.passed)]
  ].map(([title, done]) => ({ title, done }));

  return { today, attempts: sorted, lessons, srs, dueItems, mistakes, mastery, activeDays, stats, milestones, assessmentRuns: getAssessmentRuns(docs), getDoc };
}
export function getAssessmentRuns(docs) { const o = {}; for (const d of docs) if (d.kind === 'assessment_run' && !d.deleted) o[d.key] = d.data; return o; }
