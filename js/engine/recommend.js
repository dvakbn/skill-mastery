// Rule-based adaptive engine (no AI). Each rule is explicit, ordered and explainable.
import { indexContent } from './derive.js';
import { addDays, daysBetween, shuffle, rng } from './util.js';

export const RULES = [
  { id: 'R1', name: 'Due reviews', text: 'If items are due for spaced review, put a review session first. The session is capped (default 12 items ≈ 8 min); the rest roll over, oldest and weakest first.' },
  { id: 'R2', name: 'Recurring mistake drill', text: 'A concept you missed ≥ 2 times (on 2+ days, or 3+ times) and have not answered correctly twice in a row since gets a 5-question targeted drill.' },
  { id: 'R3', name: 'Remedial practice', text: 'If a skill you have started has a mastery score below 60% after at least 4 scored attempts, a 10-minute remedial set from its weakest concepts is suggested and hints are expanded in its next lessons.' },
  { id: 'R4', name: 'Stretch unlock', text: 'If a skill is at Proficient or higher with score ≥ 80%, its level-3 stretch exercises are recommended; otherwise they stay optional (and are discouraged below 50%).' },
  { id: 'R5', name: 'Skill refresh', text: 'If you reached Practising or higher in a skill but have had no evidence for 10+ days, a short refresh set is suggested.' },
  { id: 'R6', name: 'Schedule catch-up', text: 'If you are 2+ days behind the calendar, the plan slides forward (nothing is lost). At 3+ days behind a lighter-load option is offered: review capped at 8 items and optional tasks deferred. You can accept or ignore it.' },
  { id: 'R7', name: 'Assessment readiness', text: 'The weekly assessment is recommended once all of that week\'s lessons are completed. If lessons are missing it still lets you take it, but warns that results are less reliable.' },
  { id: 'R8', name: 'Assessment retake', text: 'If your last assessment was incomplete or under the pass mark, a retake is recommended after a targeted revision of the weakest skills.' },
  { id: 'R9', name: 'Review backlog control', text: 'If more than 40 items are overdue, the engine recommends two short review sessions today instead of one long one, so the backlog clears without burnout.' },
  { id: 'R10', name: 'Reflection nudge', text: 'If you skipped reflection on the last 3 active days, a reflection reminder is shown.' }
];

export function buildReviewQueue(st, settings, today) {
  const cap = settings.reviewCap || 12;
  const recurring = new Set(st.mistakes.filter(m => m.status === 'recurring').map(m => m.concept));
  const scored = st.dueItems.map(d => ({ ...d, prio: d.overdue + (recurring.has(d.item.concept) ? 3 : 0) + (d.st.lapses || 0) * 0.5 + (3 - Math.min(3, d.st.ease)) }));
  scored.sort((a, b) => b.prio - a.prio || (a.id < b.id ? -1 : 1));
  return { queue: scored.slice(0, cap), backlog: Math.max(0, scored.length - cap), total: scored.length };
}
// Pick practice items (mcq/fill from completed lessons) for a skill and/or concept, weakest first.
export function buildPractice(content, st, { skillId, concept, n = 5, seed = 'p' }) {
  const idx = indexContent(content); const out = [];
  const weak = new Set(st.mistakes.filter(m => m.status !== 'resolved').map(m => m.concept));
  for (const [id, info] of idx.items) {
    if (!(info.pool === 'quiz' || info.pool === 'bank')) continue;
    if (skillId && info.skillId !== skillId) continue; if (concept && info.item.concept !== concept) continue;
    if (!st.lessons[info.lessonId].completedAt) continue;
    const s = st.srs.get(id); const r = rng(seed + id)();
    out.push({ id, ...info, prio: (weak.has(info.item.concept) ? 3 : 0) + (s ? (2.5 - s.ease) + (s.lapses || 0) : 1) + r });
  }
  out.sort((a, b) => b.prio - a.prio); return out.slice(0, n);
}
export function exercisePlan(lesson, mastery, settings) {
  // Difficulty progression: level-3 stretch visible/recommended by mastery; hints expanded when struggling.
  const s = mastery; const mode = settings.difficulty || 'auto';
  let stretch = 'optional', support = false, reason = 'Standard path: guided exercises are core; the stretch exercise is optional.';
  if (s && s.score !== null && s.mass >= 3) {
    if (s.score >= 0.8 && s.level >= 3) { stretch = 'recommended'; reason = `Your ${Math.round(s.score * 100)}% mastery score in this skill unlocks the stretch exercise.`; }
    else if (s.score < 0.5) { stretch = 'discouraged'; support = true; reason = `Your ${Math.round(s.score * 100)}% score suggests focusing on the guided exercises first; hints are expanded.`; }
    else if (s.score < 0.6) { support = true; reason = 'Hints are expanded while your score is below 60%.'; }
  }
  if (mode === 'harder') { stretch = 'recommended'; support = false; reason = 'You chose harder practice in Settings.'; }
  if (mode === 'easier') { stretch = 'optional'; support = true; reason = 'You chose easier practice in Settings.'; }
  return { stretch, support, reason };
}

export function recommend({ content, st, plan, settings, overrides = {}, today }) {
  const recs = []; const add = r => { const o = overrides[r.id]; if (o && o.state === 'dismissed' && (!o.until || o.until >= today)) return; recs.push({ ...r, overridable: true }); };
  const { queue, backlog, total } = buildReviewQueue(st, settings, today);
  if (total > 0) add({ id: 'review-' + today, rule: 'R1', type: 'review', title: `Review ${queue.length} due item${queue.length === 1 ? '' : 's'}`, reason: `${total} item${total === 1 ? ' is' : 's are'} due for spaced review${backlog ? `; ${backlog} will roll over to later sessions` : ''}.`, minutes: Math.max(2, Math.round(queue.length * 0.65)), priority: 90, route: '#/review' });
  if (total > 40) add({ id: 'backlog-' + today, rule: 'R9', type: 'info', title: 'Split your review backlog', reason: `${total} items are overdue. Do two short sessions today (morning and evening) rather than one long one.`, minutes: 0, priority: 70, route: '#/review' });
  for (const m of st.mistakes.filter(m => m.status === 'recurring').slice(0, 2))
    add({ id: 'drill-' + m.concept, rule: 'R2', type: 'drill', title: `Drill: ${m.label}`, reason: `Missed ${m.misses} times (last ${m.lastMiss}); needs 2 correct answers in a row to clear.`, minutes: 4, priority: 85, route: `#/practice?concept=${encodeURIComponent(m.concept)}` });
  for (const s of content.skills) {
    const ms = st.mastery[s.id];
    if (ms.level >= 1 && ms.score !== null && ms.score < 0.6 && ms.attempts >= 4) add({ id: 'remedial-' + s.id, rule: 'R3', type: 'remedial', title: `Remedial practice: ${s.name}`, reason: `Mastery score ${Math.round(ms.score * 100)}% (below 60%).`, minutes: 10, priority: 80, route: `#/practice?skill=${s.id}&n=8` });
    else if (ms.level >= 3 && ms.score >= 0.8) add({ id: 'stretch-' + s.id, rule: 'R4', type: 'stretch', title: `Stretch: ${s.name}`, reason: `Score ${Math.round(ms.score * 100)}% at ${ms.levelName}: stretch exercises are recommended in its next lessons.`, minutes: 0, priority: 30, route: `#/skill/${s.id}` });
    if (ms.level >= 2 && ms.lastEvidence && daysBetween(ms.lastEvidence, today) >= 10) add({ id: 'refresh-' + s.id, rule: 'R5', type: 'refresh', title: `Refresh: ${s.name}`, reason: `No evidence for ${daysBetween(ms.lastEvidence, today)} days.`, minutes: 4, priority: 40, route: `#/practice?skill=${s.id}&n=4` });
  }
  if (plan.behind >= 2) add({ id: 'catchup-' + plan.behind, rule: 'R6', type: 'schedule', title: `You are ${plan.behind} day${plan.behind > 1 ? 's' : ''} behind the calendar`, reason: `Dates have slid forward by ${plan.shift} day(s); no lessons are lost.${plan.behind >= 3 ? ' Consider the lighter-load option in Settings.' : ''}`, minutes: 0, priority: 60, route: '#/plan', lightLoad: plan.behind >= 3 });
  // assessments
  const row = plan.activeRow;
  if (row && row.type !== 'lesson') {
    const wk = content.curriculum.weeks[row.week - 1]; const missing = row.type === 'final' ? [] : wk.days.map(d => content.curriculum.days[d - 1]).filter(d => d.type === 'lesson').flatMap(d => d.lessons).filter(id => !st.lessons[id].completedAt);
    add({ id: 'assess-' + row.assessment, rule: 'R7', type: 'assessment', title: `Take the ${row.type === 'final' ? 'final' : 'week ' + row.week} assessment`, reason: missing.length ? `${missing.length} lesson(s) this week are not completed yet; you can still take it, but results will be less reliable.` : 'All lessons for this week are completed.', minutes: 45, priority: 95, route: `#/assessment/${row.assessment}` });
  }
  const last = Object.values(st.assessmentRuns).filter(r => r.status === 'submitted').sort((a, b) => a.submittedAt < b.submittedAt ? 1 : -1)[0];
  if (last && (!last.complete || !last.result.passed)) add({ id: 'retake-' + last.defId, rule: 'R8', type: 'assessment', title: `Retake ${last.defId === 'final' ? 'final' : last.defId.replace('week-', 'week ')} assessment`, reason: !last.complete ? 'The last attempt was incomplete and does not count as mastery evidence.' : `Last score ${Math.round(last.result.pct * 100)}% was under the pass mark; revise ${((last.result.weak || []).slice(0, 2).join(', ')) || 'weak areas'} first.`, minutes: 45, priority: 88, route: `#/assessment/${last.defId}` });
  // reflection nudge
  const act = [...st.activeDays.keys()].sort().slice(-3);
  if (act.length === 3 && act.every(d => !st.getDoc('reflection', d))) add({ id: 'reflect-' + today, rule: 'R10', type: 'reflection', title: 'Write a quick reflection', reason: 'You have not reflected on your last 3 active days.', minutes: 3, priority: 50, route: '#/today' });
  recs.sort((a, b) => b.priority - a.priority); return recs;
}
