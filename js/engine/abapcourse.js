// Pure logic for the ABAP course: quiz selection, grading, mastery gate, reteach/retest loop,
// spaced repetition and the adaptive recommendations. No DOM, no storage.
import { addDays } from './util.js';
export const LADDER = [1, 3, 7, 14, 30];
export const STAGES = ['read', 'examples', 'exercise', 'quiz', 'review'];
export const newDay = () => ({ attempts: [], stagesDone: [], exerciseDone: false, hints: 0, solutionSeen: false, reteachSeen: 0, done: false });
const rng = seed => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const shuffle = (arr, seed) => { const r = rng(seed), a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Attempt 0 = main quiz, attempt 1 = the different retest questions, later attempts = every question reshuffled.
export function questionsFor(day, nAttempts) {
  if (nAttempts === 0) return day.quiz;
  if (nAttempts === 1 && day.retest.length) return day.retest;
  return shuffle([...day.quiz, ...day.retest], day.n * 131 + nAttempts).slice(0, Math.max(day.retest.length, 6));
}
export function grade(course, ids, answers) {
  let correct = 0; const missed = [];
  for (const id of ids) { const q = course.questions[id], a = answers[id]; if (a != null && a === q.answer) correct++; else missed.push({ id, tag: q.tag, said: a == null ? null : a }); }
  return { correct, total: ids.length, pct: ids.length ? correct / ids.length : 0, missed };
}
export const passed = (st, gate) => st.attempts.some(a => a.pct >= gate);
export const needsReteach = (st, gate) => st.attempts.length > 0 && !passed(st, gate) && st.reteachSeen < st.attempts.length;
export const needsRetest = (st, gate) => st.attempts.length > 0 && !passed(st, gate) && st.reteachSeen >= st.attempts.length;
export const weakTags = st => { const last = st.attempts[st.attempts.length - 1]; return last ? [...new Set(last.missed.map(m => m.tag))] : []; };
export const firstTry = st => st.attempts[0] ? st.attempts[0].pct : null;
export function dayStatus(course, st, n) {
  const d = course.days.find(x => x.n === n); if (!d) return 'unbuilt'; if (!st) return 'new';
  if (st.done) return 'done'; if (passed(st, d.gate)) return 'passed'; if (needsReteach(st, d.gate)) return 'reteach'; if (needsRetest(st, d.gate)) return 'retest';
  return st.attempts.length || st.stagesDone.length ? 'inprogress' : 'new';
}
// Strictly sequential: a day opens only when the one before it is finished.
export function unlocked(course, states, n) { if (!course.built.includes(n)) return false; return n === 1 || !!(states[n - 1] && states[n - 1].done); }
export const currentDay = (course, states) => { for (const n of course.built) if (!(states[n] && states[n].done)) return unlocked(course, states, n) ? n : null; return null; };

// Spaced repetition per concept tag. Same-day repeats do not advance the ladder.
export function srsUpdate(srs, tag, ok, today) {
  const s = { ...(srs[tag] || { step: -1, lapses: 0, last: null, due: today }) };
  if (!ok) { s.step = 0; s.lapses++; s.due = addDays(today, 1); s.last = today; }
  else if (s.last !== today) { s.step = Math.min(s.step + 1, LADDER.length - 1); if (s.step < 1) s.step = 1; s.due = addDays(today, LADDER[s.step]); s.last = today; }
  srs[tag] = s; return srs;
}
export const perTag = (course, ids, answers) => { const o = {}; for (const id of ids) { const q = course.questions[id]; o[q.tag] = o[q.tag] || { ok: 0, n: 0 }; o[q.tag].n++; if (answers[id] === q.answer) o[q.tag].ok++; } return o; };
export function applyAttempt(srs, course, ids, answers, today) { const pt = perTag(course, ids, answers); for (const [t, v] of Object.entries(pt)) srsUpdate(srs, t, v.ok === v.n, today); return srs; }
export const dueTags = (srs, today) => Object.entries(srs).filter(([, s]) => s.due <= today).sort((a, b) => a[1].due < b[1].due ? -1 : 1).map(([t]) => t);
// Warm-up: for each due tag (most overdue first) one question from a finished day, rotating through the bank.
export function pickWarmup(course, srs, states, today, max = 4) {
  const out = [], seenQ = srs.__seen || {};
  for (const t of dueTags(srs, today)) {
    if (t === '__seen') continue; const tag = course.tags[t]; if (!tag) continue;
    const pool = Object.entries(course.questions).filter(([, q]) => q.tag === t && states[q.day] && states[q.day].attempts.length).map(([id]) => id);
    if (!pool.length) continue; pool.sort((a, b) => (seenQ[a] || 0) - (seenQ[b] || 0)); out.push(pool[0]); if (out.length >= max) break;
  }
  return out;
}
export const markSeen = (srs, ids, today) => { srs.__seen = srs.__seen || {}; ids.forEach(id => { srs.__seen[id] = (srs.__seen[id] || 0) + 1; }); return srs; };
// Adaptive recommendations for the next study session.
export function advice(course, states, srs, today) {
  const out = [], cur = currentDay(course, states), tags = Object.keys(srs).filter(t => t !== '__seen');
  const due = dueTags({ ...Object.fromEntries(tags.map(t => [t, srs[t]])) }, today);
  if (due.length) out.push({ id: 'warmup', text: `${due.length} concept${due.length > 1 ? 's are' : ' is'} due. Do the ${Math.min(4, due.length)}-question warm-up before today's chapter.` });
  const prev = cur && states[cur - 1];
  if (prev && firstTry(prev) != null) {
    if (firstTry(prev) >= 0.9) out.push({ id: 'stretch', text: 'Yesterday was a first-try 90%+. Do the stretch task today and skip re-reading the examples.' });
    else if (firstTry(prev) < 0.7) out.push({ id: 'slow', text: 'Yesterday needed reteaching. Spend 5 extra minutes on the hints for each exercise today and do not skip the review stage.' });
  }
  const lapsed = tags.filter(t => srs[t].lapses >= 2); if (lapsed.length) out.push({ id: 'lapsed', text: `Weak spots that keep coming back: ${lapsed.map(t => course.tags[t] ? course.tags[t].title : t).join(', ')}. Redo the extra exercise for each.` });
  return out;
}
export function summary(course, states, srs, today) {
  const done = course.built.filter(n => states[n] && states[n].done), ft = done.map(n => firstTry(states[n])).filter(x => x != null);
  const tags = Object.keys(srs).filter(t => t !== '__seen');
  return { daysDone: done.length, built: course.built.length, total: course.plan.length, avgFirstTry: ft.length ? ft.reduce((a, b) => a + b, 0) / ft.length : null, due: dueTags(Object.fromEntries(tags.map(t => [t, srs[t]])), today).length, solid: tags.filter(t => srs[t].step >= 2).length, shaky: tags.filter(t => srs[t].step < 2).length };
}
