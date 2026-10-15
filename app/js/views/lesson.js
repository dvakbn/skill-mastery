import { h, mdEl, pctText, toast, bar } from '../ui/lib.js';
import { renderItem } from '../ui/items.js';
import { exercisePlan } from '../engine/recommend.js';
import { words, dayKey } from '../engine/util.js';

const STEPS = [['concept', 'Learn'], ['examples', 'Examples'], ['practice', 'Practice'], ['task', 'Task'], ['quiz', 'Quiz'], ['summary', 'Summary']];
export function lessonView(ctx, id, params = {}) {
  const { repo, content } = ctx; const L = content.lessons[id]; const root = h('div', { class: 'view lesson' });
  if (!L) { root.append(h('h1', 'Lesson unavailable'), h('p', 'This lesson is not part of the installed curriculum.')); return { el: root }; }
  const skill = content.skills.find(s => s.id === L.skillId);
  const attemptsFor = (itemId) => repo.attempts.filter(a => a.item_id === itemId && a.context === 'lesson');
  const lessonDoc = () => (repo.getDoc('lesson', id) || { data: {} }).data;
  const sectionDone = k => !!(lessonDoc().sections || {})[k];
  const markSection = async (k) => repo.updateDoc('lesson', id, d => { d.sections = d.sections || {}; if (!d.sections[k]) d.sections[k] = new Date().toISOString(); d.startedAt = d.startedAt || new Date().toISOString(); return d; }, { sections: {} });
  if (!lessonDoc().startedAt) markSection('opened').catch(() => { });
  let step = Math.max(0, Math.min(5, parseInt(params.step ?? firstOpenStep())));
  function firstOpenStep() { for (let i = 0; i < 5; i++) if (!stepComplete(STEPS[i][0])) return i; return 5; }
  function stepComplete(k) {
    if (k === 'concept' || k === 'examples') return sectionDone(k);
    if (k === 'practice') return L.exercises.slice(0, 3).every(e => attemptsFor(e.id).length);
    if (k === 'task') return !!((repo.getDoc('task', id) || { data: {} }).data.completedAt);
    if (k === 'quiz') return L.quiz.every(q => attemptsFor(q.id).length);
    return !!lessonDoc().completedAt;
  }
  const nav = h('nav', { class: 'steps', 'aria-label': 'Lesson steps' }); const body = h('div', { class: 'stepbody' });
  const mins = L.minutes; const head = h('header', { class: 'lhead' }, h('a', { href: '#/today', class: 'back' }, '← Today'), h('p', { class: 'eyebrow' }, skill.name, ' · lesson ', L.n, ' of ', skill.lessons.length, ' · ', Object.values(mins).reduce((a, b) => a + b, 0), ' min'), h('h1', L.title), h('p', { class: 'lead' }, L.summary), h('ul', { class: 'objs' }, L.objectives.map(o => h('li', o))));
  root.append(head, nav, body);
  const drawNav = () => { nav.replaceChildren(...STEPS.map(([k, label], i) => h('button', { class: 'step' + (i === step ? ' cur' : '') + (stepComplete(k) ? ' done' : ''), onclick: () => go(i), 'aria-current': i === step ? 'step' : null }, h('span', { class: 'n' }, stepComplete(k) && k !== 'summary' ? '✓' : i + 1), h('span', label), k !== 'summary' ? h('small', mins[k] + 'm') : null))); };
  const go = (i) => { step = i; drawNav(); draw(); window.scrollTo({ top: 0 }); };
  const next = (label = 'Continue') => h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => go(Math.min(5, step + 1)) }, label));

  function draw() {
    body.replaceChildren(); const k = STEPS[step][0];
    if (k === 'concept') {
      for (const s of L.explanation) body.append(h('section', { class: 'card' }, h('h2', s.heading), mdEl(s.body)));
      body.append(h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: async () => { await markSection('concept'); go(1); } }, 'I have read this, continue')));
    } else if (k === 'examples') {
      for (const e of L.examples) body.append(h('section', { class: 'card example' }, h('h2', e.title), mdEl(e.body), h('p', { class: 'takeaway' }, h('strong', 'Notice: '), e.takeaway)));
      body.append(h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: async () => { await markSection('examples'); go(2); } }, 'Continue to practice')));
    } else if (k === 'practice') {
      const ms = repo.state().mastery[L.skillId]; const plan = exercisePlan(L, ms, repo.settings());
      body.append(h('p', { class: 'note' }, h('strong', 'Difficulty: '), plan.reason));
      const list = L.exercises.slice(0, 3); const stretch = L.exercises[3];
      const card = (e, tag) => {
        const wrap = h('section', { class: 'card ex' }); const prev = attemptsFor(e.id); const best = prev.length ? Math.max(...prev.map(a => a.score / a.max_score)) : null;
        const head = h('div', { class: 'exhead' }, h('span', { class: 'tag' }, tag), h('span', { class: 'tag t-' + e.type }, { mcq: 'Multiple choice', fill: 'Short answer', scenario: 'Decision', roleplay: 'Role-play', written: 'Written' }[e.type]), best !== null ? h('span', { class: 'tag ok' }, 'Best ' + pctText(best) + ' · ' + prev.length + ' attempt' + (prev.length > 1 ? 's' : '')) : null);
        const mount = () => { const w = renderItem(e, { support: plan.support, onResult: async r => { await repo.recordAttempt({ kind: 'exercise', context: 'lesson', lesson_id: id, item_id: e.id, skill_id: L.skillId, concept: e.concept, score: r.score, max_score: r.max, correct: r.correct, complete: r.complete !== false, duration_ms: r.durationMs, answer: { type: e.type, response: r.response } }); await markSection('practiceStarted'); drawNav(); const again = h('button', { class: 'btn ghost', onclick: () => { slot.replaceChildren(mount()); } }, 'Try again'); w.append(again); if (STEPS.slice(0, 3).length && stepComplete('practice')) { await markSection('practice'); drawNav(); } } }); return w; };
        const slot = h('div', mount()); wrap.append(head, slot); return wrap;
      };
      list.forEach((e, i) => body.append(card(e, 'Exercise ' + (i + 1))));
      const sw = h('details', { class: 'stretch', open: plan.stretch === 'recommended' ? true : null }, h('summary', 'Stretch exercise (optional) ', h('span', { class: 'tag ' + (plan.stretch === 'recommended' ? 'ok' : '') }, plan.stretch === 'recommended' ? 'Recommended for you' : plan.stretch === 'discouraged' ? 'Come back after the basics' : 'Optional')), card(stretch, 'Stretch'));
      body.append(sw, next('Continue to the task'));
    } else if (k === 'task') {
      const T = L.task; const doc = (repo.getDoc('task', id) || { data: { checked: [], evidence: '' } }).data; const checked = T.checklist.map((_, i) => !!(doc.checked || [])[i]); let ev = doc.evidence || '';
      const save = (extra = {}) => repo.saveDoc('task', id, { checked, evidence: ev, evidenceTs: Date.now(), completedAt: doc.completedAt || null, ...extra });
      const done = !!doc.completedAt; const evEl = h('textarea', { class: 'txt', rows: 4, placeholder: T.evidencePrompt, disabled: done || null }, ev); const cnt = h('span', { class: 'sm muted' });
      const btn = h('button', { class: 'btn', onclick: async () => { const when = new Date().toISOString(); await save({ completedAt: when }); await repo.recordAttempt({ kind: 'task', context: 'lesson', lesson_id: id, item_id: id + '.task', skill_id: L.skillId, score: 1, max_score: 1, correct: true, answer: { evidence: ev } }); toast('Task logged ✓'); drawNav(); doc.completedAt = when; draw(); } }, 'Mark task complete');
      const upd = () => { const n = words(ev); cnt.textContent = `${n} / ${T.evidenceWords} words`; btn.disabled = done || !(checked.every(Boolean) && n >= T.evidenceWords); };
      body.append(h('section', { class: 'card' }, h('h2', T.title), h('p', { class: 'muted' }, 'Do this away from the screen · about ', T.minutes, ' minutes'), mdEl(T.brief), h('h3', 'Steps'), h('ol', T.steps.map(s => h('li', s))), h('h3', 'Checklist'), h('div', { class: 'checks' }, T.checklist.map((c, i) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: checked[i] || null, disabled: done || null, onchange: e => { checked[i] = e.target.checked; save(); upd(); } }), h('span', c)))), h('h3', 'Evidence'), h('p', { class: 'sm' }, T.evidencePrompt), evEl, h('div', { class: 'row between' }, cnt, done ? h('span', { class: 'tag ok' }, 'Completed ✓') : btn)));
      evEl.addEventListener('input', () => { ev = evEl.value; upd(); }); evEl.addEventListener('blur', () => { if (!done) save(); }); upd();
      body.append(h('p', { class: 'sm muted' }, 'A completed task counts toward lesson completion. It is not scored, so it never raises mastery on its own.'), next('Continue to the quiz'));
    } else if (k === 'quiz') {
      let qi = L.quiz.findIndex(q => !attemptsFor(q.id).length); const box = h('div'); body.append(h('p', { class: 'note' }, 'Four questions covering every concept. Answer from memory first; guidance appears after each answer.'), box);
      const show = () => {
        box.replaceChildren(); if (qi === -1) { const sc = L.quiz.map(q => { const a = attemptsFor(q.id); return a[a.length - 1].score / a[a.length - 1].max_score; }); box.append(h('section', { class: 'card' }, h('h2', 'Quiz complete'), h('p', { class: 'big' }, pctText(sc.reduce((a, b) => a + b, 0) / sc.length)), h('p', `${sc.filter(x => x >= 0.7).length} of ${sc.length} correct. Anything you missed will come back in spaced review.`)), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: async () => { await markSection('quiz'); go(5); } }, 'See lesson summary'))); return; }
        const q = L.quiz[qi]; box.append(h('section', { class: 'card' }, h('p', { class: 'eyebrow' }, `Question ${qi + 1} of ${L.quiz.length}`), renderItem(q, { onResult: async r => { await repo.recordAttempt({ kind: 'quiz', context: 'lesson', lesson_id: id, item_id: q.id, skill_id: L.skillId, concept: q.concept, score: r.score, max_score: r.max, correct: r.correct, duration_ms: r.durationMs, answer: { type: q.type, response: r.response } }); drawNav(); const nxt = h('button', { class: 'btn', onclick: () => { qi = L.quiz.findIndex(x => !attemptsFor(x.id).length); show(); } }, qi + 1 < L.quiz.length ? 'Next question' : 'Finish quiz'); box.firstChild.append(h('div', { class: 'row end' }, nxt)); } })));
      }; show();
    } else {
      const done = !!lessonDoc().completedAt; const reqs = [['Read the explanation', sectionDone('concept')], ['Studied the examples', sectionDone('examples')], ['Attempted exercises 1-3', stepComplete('practice')], ['Completed the practical task', stepComplete('task')], ['Answered all 4 quiz questions', stepComplete('quiz')]]; const allOk = reqs.every(r => r[1]);
      const lastScore = (arr) => arr.map(x => { const a = attemptsFor(x.id); return a.length ? a[a.length - 1].score / a[a.length - 1].max_score : null; });
      const qs = lastScore(L.quiz), es = lastScore(L.exercises);
      body.append(h('section', { class: 'card' }, h('h2', done ? 'Lesson complete ✓' : 'Finish this lesson'), h('ul', { class: 'reqs' }, reqs.map(([t, ok]) => h('li', { class: ok ? 'ok' : '' }, ok ? '✓ ' : '○ ', t))),
        !done ? h('button', { class: 'btn', disabled: !allOk || null, onclick: async () => { await repo.updateDoc('lesson', id, d => { d.completedAt = new Date().toISOString(); d.sections = d.sections || {}; d.sections.summary = d.completedAt; return d; }, { sections: {} }); toast('Lesson completed ✓', 'ok'); drawNav(); draw(); } }, 'Mark lesson complete') : null,
        h('p', { class: 'note' }, h('strong', 'Completion is not mastery. '), 'Finishing the lesson unlocks spaced reviews, which start tomorrow. Your skill level rises only when you show good, delayed performance.')));
      const ms = repo.state().mastery[L.skillId];
      body.append(h('section', { class: 'card' }, h('h2', 'How you did'), h('div', { class: 'grid2' }, h('div', h('p', { class: 'muted' }, 'Quiz'), h('p', { class: 'big' }, qs.every(x => x !== null) ? pctText(qs.reduce((a, b) => a + b, 0) / qs.length) : '—')), h('div', h('p', { class: 'muted' }, 'Exercises (1-3)'), h('p', { class: 'big' }, es.slice(0, 3).every(x => x !== null) ? pctText(es.slice(0, 3).reduce((a, b) => a + b, 0) / 3) : '—'))), h('p', `${skill.name}: level ${ms.level} (${ms.levelName}), score ${pctText(ms.score)}`), ms.needs.length ? h('ul', { class: 'reqs' }, ms.needs.map(n => h('li', { class: n.ok ? 'ok' : '' }, (n.ok ? '✓ ' : '○ ') + n.text))) : null));
      body.append(h('section', { class: 'card' }, h('h2', 'Revise'), h('ul', L.revision.keyPoints.map(p => h('li', p))), h('p', h('strong', 'Quick redo (2 min), repeat in 3, 7 and 21 days: '), L.revision.redo)));
      const nextId = ctx.nextLessonAfter(id); body.append(h('div', { class: 'row between' }, h('a', { class: 'btn ghost', href: '#/today' }, 'Back to Today'), nextId ? h('a', { class: 'btn', href: '#/lesson/' + nextId }, 'Next lesson →') : null));
    }
  }
  drawNav(); draw(); return { el: root };
}
