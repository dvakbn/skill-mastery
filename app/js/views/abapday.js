// ABAP 30-day course screens: roadmap, daily chapter cycle, and the spaced-repetition warm-up.
import { h, mdEl, pctText, bar, toast, confirmDialog } from '../ui/lib.js';
import { dayKey } from '../engine/util.js';
import * as E from '../engine/abapcourse.js';

let COURSE = null;
export async function loadCourse() { if (COURSE) return COURSE; const r = await fetch('data/abap-course.json'); if (!r.ok) throw new Error('HTTP ' + r.status); COURSE = await r.json(); return COURSE; }
export const readStates = (repo, course) => { const o = {}; for (const n of course.built) { const d = repo.getDoc('abap_day', 'd' + n); if (d) o[n] = { ...E.newDay(), ...d.data }; } return o; };
export const readSrs = repo => { const d = repo.getDoc('abap_srs', 'main'); return d ? JSON.parse(JSON.stringify(d.data)) : {}; };
const saveDay = (repo, n, fn) => repo.updateDoc('abap_day', 'd' + n, d => fn({ ...E.newDay(), ...d }), E.newDay());
const saveSrs = (repo, fn) => repo.updateDoc('abap_srs', 'main', d => fn(d), {});
const today = () => dayKey();
const STATUS = { done: ['Done', 'ok'], passed: ['Passed, finish review', ''], reteach: ['Reteach needed', 'bad'], retest: ['Retest needed', 'bad'], inprogress: ['In progress', ''], new: ['Ready', ''], unbuilt: ['Built after the previous checkpoint', ''] };
const copyBtn = text => h('button', { class: 'btn ghost sm', onclick: async () => { try { await navigator.clipboard.writeText(text.replace(/^```[a-z]*\n|\n```$/g, '')); toast('Copied', 'ok'); } catch { toast('Select and copy the code'); } } }, 'Copy code');

export function renderCourse(root, ctx, course, route) {
  if (route === 'plan') return plan(root, ctx, course);
  if (route === 'review') return warmup(root, ctx, course);
  const m = /^day-(\d+)$/.exec(route); if (m) return dayView(root, ctx, course, +m[1]);
  return plan(root, ctx, course);
}

function plan(root, ctx, course) {
  const { repo } = ctx, sts = readStates(repo, course), srs = readSrs(repo), sum = E.summary(course, sts, srs, today()), cur = E.currentDay(course, sts);
  root.replaceChildren(h('a', { href: '#/abap', class: 'back' }, '← SAP ABAP'), h('h1', '30-day roadmap'),
    h('p', { class: 'lead' }, `One chapter a day, about ${course.minutesPerDay} minutes. A day opens only when the one before it is finished, and a chapter is finished only when you pass its quiz.`),
    h('section', { class: 'card' }, h('div', { class: 'grid3' }, h('div', h('p', { class: 'muted sm' }, 'Days finished'), h('p', { class: 'big sm' }, `${sum.daysDone}/${sum.total}`), bar(sum.daysDone / sum.total)), h('div', h('p', { class: 'muted sm' }, 'First-try quiz average'), h('p', { class: 'big sm' }, pctText(sum.avgFirstTry))), h('div', h('p', { class: 'muted sm' }, 'Concepts due / solid'), h('p', { class: 'big sm' }, `${sum.due} / ${sum.solid}`)))),
    h('p', { class: 'note' }, `Days ${course.built[0]}–${course.built.at(-1)} are ready. Each later phase is written after the previous checkpoint so it can use your results, and the 30-day limit stays fixed.`),
    ...course.phases.map(p => h('section', { class: 'card' }, h('p', { class: 'eyebrow' }, `Phase ${p.id} · days ${p.from}–${p.to}`), h('h2', p.label), h('p', { class: 'sm muted' }, p.blurb),
      ...course.plan.filter(d => d.phase === p.id).map(d => {
        const s = E.dayStatus(course, sts[d.n], d.n), open = E.unlocked(course, sts, d.n), [lab, cls] = STATUS[s];
        const row = h('div', { class: 'row between' }, h('div', h('strong', `Day ${d.n}${d.checkpoint ? ' · checkpoint' : ''}: ${d.title}`), h('p', { class: 'sm muted' }, d.topics)), h('span', { class: 'tag ' + cls }, d.n === cur ? 'Today' : lab));
        return open ? h('a', { href: '#/abap/day-' + d.n, class: 'daylink' }, row) : h('div', { class: 'daylink off' }, row);
      }))));
}

function dayView(root, ctx, course, n) {
  const { repo } = ctx, day = course.days.find(d => d.n === n);
  const back = h('a', { href: '#/abap/plan', class: 'back' }, '← Roadmap');
  if (!day) return root.replaceChildren(back, h('h1', `Day ${n}`), h('p', { class: 'note' }, 'This day has not been written yet. It is designed after the previous checkpoint, using your results.'));
  if (!E.unlocked(course, readStates(repo, course), n)) return root.replaceChildren(back, h('h1', `Day ${n}: ${day.title}`), h('p', { class: 'note' }, 'Locked until the previous day is finished.'), h('a', { class: 'btn', href: '#/abap/day-' + (E.currentDay(course, readStates(repo, course)) || 1) }, 'Go to your current day'));
  const stages = E.STAGES.filter(s => s !== 'examples' || day.examples.length), LAB = { read: 'Read', examples: 'Examples', exercise: 'Exercise', quiz: 'Quiz', review: 'Review' };
  const st = () => readStates(repo, course)[n] || E.newDay();
  let stage = null, answers = {}, flash = null;
  const status = () => E.dayStatus(course, readStates(repo, course)[n], n);
  const first = () => { const s = st(); if (['reteach', 'retest'].includes(status())) return 'quiz'; return stages.find(x => !s.stagesDone.includes(x)) || 'review'; };
  const open = i => st().done || i === 0 || st().stagesDone.includes(stages[i - 1]);
  const mark = async s => { await saveDay(repo, n, d => { if (!d.stagesDone.includes(s)) d.stagesDone.push(s); return d; }); };
  const go = s => { stage = s; draw(); window.scrollTo({ top: 0 }); };
  const next = async s => { await mark(s); go(stages[stages.indexOf(s) + 1] || 'review'); };

  const tabs = () => h('nav', { class: 'steps' }, ...stages.map((s, i) => h('button', { class: 'step' + (s === stage ? ' cur' : '') + (st().stagesDone.includes(s) ? ' done' : ''), disabled: !open(i), onclick: () => go(s) }, h('span', { class: 'n' }, i + 1), h('span', LAB[s]), h('small', `${day.minutes[s] || 0} min`))));
  const stepsMd = a => mdEl(a.map((x, i) => `${i + 1}. ${x}`).join('\n'));

  const stRead = () => [mdEl(day.read), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => next('read') }, day.examples.length ? 'Done reading → Examples' : 'Done reading → Exercise'))];
  const stExamples = () => [h('p', { class: 'note' }, 'Type each example into SE38 yourself and run it. Typing teaches more than pasting.'), ...day.examples.map(e => h('section', { class: 'card' }, h('h3', e.title), mdEl(e.code), h('p', { class: 'sm' }, e.notes), copyBtn(e.code))), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => next('examples') }, 'Done → Exercise'))];
  const stExercise = () => {
    const ex = day.exercise, s = st(), shown = Math.min(s.hints, ex.hints.length); const sol = h('div');
    const showSol = () => { sol.replaceChildren(mdEl(ex.solution), copyBtn(ex.solution), h('p', { class: 'sm muted' }, 'Tomorrow, retype it from memory without looking.')); };
    if (s.solutionSeen) showSol();
    const hints = h('div'); const drawHints = () => { const n2 = Math.min(st().hints, ex.hints.length); hints.replaceChildren(...ex.hints.slice(0, n2).map((t, i) => h('div', { class: 'note' }, h('strong', `Hint ${i + 1}: `), mdEl(t, 'prose sm'))), n2 < ex.hints.length ? h('button', { class: 'btn ghost sm', onclick: async () => { await saveDay(repo, n, d => { d.hints++; return d; }); drawHints(); } }, `Show hint ${n2 + 1} of ${ex.hints.length}`) : null); }; drawHints();
    const checks = ex.expect.map(t => h('label', { class: 'chk' }, h('input', { type: 'checkbox' }), ' ', h('span', { html: t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>') })));
    return [h('section', { class: 'card' }, h('h2', ex.title), h('p', ex.brief), stepsMd(ex.steps)), h('section', { class: 'card' }, h('h3', 'Expected result'), ...checks), h('section', { class: 'card' }, h('h3', 'Stuck?'), h('p', { class: 'sm muted' }, 'Try for 10 minutes first. Hints get stronger one at a time.'), hints,
      h('button', { class: 'btn ghost sm', onclick: async () => { if (st().solutionSeen || await confirmDialog('Show the full solution? Try the hints first; you learn more by fixing your own program.', { ok: 'Show solution', cancel: 'Keep trying' })) { await saveDay(repo, n, d => { d.solutionSeen = true; return d; }); showSol(); } } }, 'Show full solution'), sol),
      h('details', { class: 'card' }, h('summary', 'Stretch task (optional)'), mdEl(ex.stretch.brief), h('details', h('summary', 'Answer'), mdEl(ex.stretch.solution))),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { if (checks.some(c => !c.firstChild.checked) && !(await confirmDialog('Not every expected result is ticked. Mark the exercise done anyway?', { ok: 'Mark done', cancel: 'Go back' }))) return; await saveDay(repo, n, d => { d.exerciseDone = true; return d; }); next('exercise'); } }, 'I ran it and it matches → Quiz'))];
  };
  const stQuiz = () => {
    const s = st(), stt = status(), out = [];
    if (flash) { out.push(h('section', { class: 'card result ' + (flash.pct >= day.gate ? 'pass' : 'fail') }, h('p', { class: 'big sm' }, pctText(flash.pct)), h('p', flash.pct >= day.gate ? `Passed (${flash.correct}/${flash.total}). Continue to review.` : `${flash.correct}/${flash.total}. The pass mark is ${Math.round(day.gate * 100)}%, so we reteach the weak parts first, then retest with different questions.`))); }
    if (['passed', 'done'].includes(stt)) return [...out, h('p', { class: 'note' }, 'Quiz passed.'), h('button', { class: 'btn', onclick: () => go('review') }, 'Go to review')];
    if (stt === 'reteach') {
      const tags = E.weakTags(s);
      return [...out, h('h2', 'Reteach: the parts that need work'), h('p', { class: 'lead' }, 'Read each block, do its small extra exercise in SAP Logon, then take the retest.'),
        ...tags.map(t => { const tg = course.tags[t]; return h('section', { class: 'card' }, h('p', { class: 'eyebrow' }, 'Concept'), h('h3', tg.title), mdEl(tg.reteach), h('div', { class: 'note' }, h('strong', 'Extra exercise: '), mdEl(tg.extra.brief, 'prose sm'), h('details', h('summary', 'Answer'), mdEl(tg.extra.solution, 'prose sm')))); }),
        h('button', { class: 'btn', onclick: async () => { flash = null; await saveDay(repo, n, d => { d.reteachSeen = d.attempts.length; return d; }); draw(); } }, 'I worked through these → retest me')];
    }
    const ids = E.questionsFor(day, s.attempts.length);
    const head = s.attempts.length ? [h('h2', 'Retest'), h('p', { class: 'lead' }, 'Different questions on the concepts you missed. Pass to move on.')] : [h('h2', 'Quiz'), h('p', { class: 'lead' }, `No help while answering. Pass mark ${Math.round(day.gate * 100)}%.`)];
    const cards = ids.map((id, i) => { const q = course.questions[id], btns = []; const card = h('section', { class: 'card ex' }, h('p', { class: 'eyebrow' }, `Question ${i + 1} of ${ids.length}`), mdEl(q.prompt, 'prompt'), h('div', { class: 'opts', role: 'radiogroup' }, ...q.options.map((o, k) => { const b = h('button', { class: 'opt' + (answers[id] === k ? ' sel' : ''), role: 'radio', 'aria-checked': String(answers[id] === k), onclick: () => { answers[id] = k; btns.forEach((x, j) => { x.classList.toggle('sel', j === k); x.setAttribute('aria-checked', String(j === k)); }); } }, h('span', { class: 'k' }, 'ABCD'[k]), h('span', o)); btns.push(b); return b; }))); return card; });
    const submit = async () => {
      const left = ids.filter(id => answers[id] == null).length; if (left && !(await confirmDialog(`${left} unanswered question(s) count as wrong. Submit anyway?`, { ok: 'Submit', cancel: 'Keep going' }))) return;
      const g = E.grade(course, ids, answers); const bank = s.attempts.length === 0 ? 'quiz' : s.attempts.length === 1 ? 'retest' : 'mixed';
      await saveDay(repo, n, d => { d.attempts.push({ ts: Date.now(), bank, ids, answers, correct: g.correct, total: g.total, pct: g.pct, missed: g.missed }); if (g.pct >= day.gate && !d.stagesDone.includes('quiz')) d.stagesDone.push('quiz'); return d; });
      await saveSrs(repo, d => E.applyAttempt(d, course, ids, answers, today()));
      flash = { pct: g.pct, correct: g.correct, total: g.total }; answers = {}; stage = g.pct >= day.gate ? 'review' : 'quiz'; draw(); window.scrollTo({ top: 0 });
    };
    return [...head, ...cards, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: submit }, 'Submit answers'))];
  };
  const stReview = () => {
    const s = st(), stt = status(); if (!['passed', 'done'].includes(stt)) return [h('p', { class: 'note' }, 'Review opens after you pass the quiz.')];
    const miss = new Map(); s.attempts.forEach(a => a.missed.forEach(m => { if (!miss.has(m.id)) miss.set(m.id, m); }));
    const next = course.built.includes(n + 1) ? n + 1 : null;
    const out = [h('section', { class: 'card' }, h('h2', 'Your attempts'), ...s.attempts.map((a, i) => h('div', { class: 'row between' }, h('span', `Attempt ${i + 1} (${a.bank})`), h('span', { class: 'tag' + (a.pct >= day.gate ? ' ok' : '') }, `${a.correct}/${a.total} · ${pctText(a.pct)}`))))];
    out.push(h('h2', 'Correct what you missed'));
    if (!miss.size) out.push(h('p', { class: 'muted' }, 'Nothing missed. Clean sheet.'));
    [...miss.values()].forEach(m => { const q = course.questions[m.id]; out.push(h('section', { class: 'card ex' }, h('p', { class: 'eyebrow' }, course.tags[q.tag].title), mdEl(q.prompt, 'prompt'), h('div', { class: 'opts' }, ...q.options.map((o, k) => h('div', { class: 'opt' + (k === q.answer ? ' right' : k === m.said ? ' wrong' : '') }, h('span', { class: 'k' }, 'ABCD'[k]), h('span', o)))), h('p', { class: 'sm' }, h('strong', 'Why: '), q.why))); });
    out.push(h('section', { class: 'card' }, h('p', { class: 'eyebrow' }, 'Milestone'), h('p', day.milestone), s.done ? h('p', { class: 'note' }, 'Day complete. Missed concepts return in your warm-ups at growing intervals.') : h('button', { class: 'btn', onclick: async () => { await saveDay(repo, n, d => { d.done = true; d.doneAt = new Date().toISOString(); if (!d.stagesDone.includes('review')) d.stagesDone.push('review'); return d; }); toast('Day ' + n + ' complete', 'ok'); draw(); window.scrollTo({ top: 0 }); } }, 'Finish Day ' + n), s.done && next ? h('a', { class: 'btn', href: '#/abap/day-' + next }, `Day ${next} →`) : null, s.done && !next ? h('p', { class: 'sm muted' }, 'The next days are written from your results. Tell me when you have finished this one.') : null));
    return out;
  };
  const BODY = { read: stRead, examples: stExamples, exercise: stExercise, quiz: stQuiz, review: stReview };
  function draw() {
    if (!stage) stage = first(); const sts = readStates(repo, course), srs = readSrs(repo), adv = E.advice(course, sts, srs, today());
    const hasDue = adv.find(a => a.id === 'warmup');
    root.replaceChildren(back, h('p', { class: 'eyebrow' }, `Day ${n} of 30 · ${day.checkpoint ? 'checkpoint' : 'chapter'} · about ${Object.values(day.minutes).reduce((a, b) => a + b, 0)} min`), h('h1', day.title), h('p', { class: 'lead' }, day.goal),
      ...(sts[n] && sts[n].done ? [] : adv.map(a => h('p', { class: 'note' }, a.text, a.id === 'warmup' ? [' ', h('a', { href: '#/abap/review' }, 'Start warm-up')] : null))),
      tabs(), ...BODY[stage]());
    void hasDue;
  }
  draw();
}

function warmup(root, ctx, course) {
  const { repo } = ctx, back = h('a', { href: '#/abap', class: 'back' }, '← SAP ABAP'), srs = readSrs(repo), sts = readStates(repo, course), ids = E.pickWarmup(course, srs, sts, today());
  if (!ids.length) return root.replaceChildren(back, h('h1', 'Warm-up'), h('p', { class: 'note' }, 'Nothing is due today. Concepts you miss come back here automatically after 1 day, then 3, 7, 14 and 30.'));
  let i = 0; const ans = {};
  const show = () => {
    if (i >= ids.length) return finish(); const q = course.questions[ids[i]], btns = [];
    const fb = h('div'); root.replaceChildren(back, h('h1', 'Warm-up'), h('p', { class: 'lead' }, `${ids.length} due concept${ids.length > 1 ? 's' : ''}. Answers are explained right away here.`),
      h('section', { class: 'card ex' }, h('p', { class: 'eyebrow' }, `${i + 1} of ${ids.length} · ${course.tags[q.tag].title}`), mdEl(q.prompt, 'prompt'), h('div', { class: 'opts' }, ...q.options.map((o, k) => { const b = h('button', { class: 'opt', onclick: () => { if (ans[ids[i]] != null) return; ans[ids[i]] = k; btns.forEach((x, j) => { x.classList.toggle('right', j === q.answer); x.classList.toggle('wrong', j === k && k !== q.answer); }); fb.replaceChildren(h('p', { class: 'sm' }, h('strong', k === q.answer ? 'Correct. ' : 'Not quite. '), q.why), h('button', { class: 'btn', onclick: () => { i++; show(); } }, i + 1 < ids.length ? 'Next' : 'Finish')); } }, h('span', { class: 'k' }, 'ABCD'[k]), h('span', o)); btns.push(b); return b; })), fb));
  };
  async function finish() {
    await saveSrs(repo, d => { E.applyAttempt(d, course, ids, ans, today()); E.markSeen(d, ids, today()); return d; });
    const ok = ids.filter(id => ans[id] === course.questions[id].answer).length;
    root.replaceChildren(back, h('h1', 'Warm-up done'), h('section', { class: 'card result' }, h('p', { class: 'big' }, `${ok}/${ids.length}`), h('p', ok === ids.length ? 'All solid. These come back later at a longer interval.' : 'The ones you missed come back tomorrow.')), h('a', { class: 'btn', href: '#/abap' }, 'Back'));
  }
  show();
}
