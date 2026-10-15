import { h, mdEl, pctText, toast, bar, confirmDialog, fmtDate } from '../ui/lib.js';
import { renderItem } from '../ui/items.js';
import { selectAutoItems, scoreAssessment } from '../engine/assessment.js';
import { gradeItem } from '../engine/grading.js';
import { indexContent } from '../engine/derive.js';
import { uuid, dayKey } from '../engine/util.js';
import { detId } from '../repo.js';

// Survives live re-renders (the router rebuilds the view when data changes), unlike per-render params.
const FRESH = new Set();
export function assessmentView(ctx, defId, params = {}) {
  const { repo, content } = ctx; const def = content.assessments[defId]; const root = h('div', { class: 'view assess' });
  if (!def) { root.append(h('h1', 'Assessment unavailable'), h('p', 'This assessment is not part of the installed curriculum.')); return { el: root }; }
  const runs = () => repo.docs.filter(d => d.kind === 'assessment_run' && !d.deleted && d.data.defId === defId);
  const open = () => runs().filter(d => d.data.status === 'in_progress').sort((a, b) => a.data.startedAt < b.data.startedAt ? 1 : -1)[0];
  const lastSubmitted = () => runs().filter(d => d.data.status === 'submitted').sort((a, b) => a.data.submittedAt < b.data.submittedAt ? 1 : -1)[0];
  const draw = () => { root.replaceChildren(h('a', { href: '#/today', class: 'back' }, '← Today')); const r = open(); if (r) return runView(r); const l = lastSubmitted(); if (l && !FRESH.has(defId)) return resultView(l); return intro(); };

  function intro() {
    const st = repo.state(); const covered = def.id === 'final' ? content.skills.map(s => s.id) : def.coverage; const missing = Object.values(st.lessons).filter(l => covered.includes(l.skillId) && l.available && !l.completedAt && content.curriculum.lessonDay[l.id] <= def.day).map(l => l.id);
    root.append(h('h1', def.title), h('p', { class: 'lead' }, def.intro),
      h('section', { class: 'card' }, h('h2', 'How it is graded'), h('ul', h('li', 'Part A: auto-graded questions drawn from lessons you completed (weighted toward your weak areas, plus a few from earlier weeks): 50%.'), h('li', 'Part B: decision scenarios and role-plays: 20%.'), h('li', 'Part C: written task, self-scored against a rubric after you compare with a model answer: 30%.'), h('li', `Pass mark ${def.passMark}%. Answers in Parts A and B are final once checked. You can stop and resume.`), h('li', 'An incomplete assessment is saved but never counts as mastery evidence.')),
        missing.length ? h('p', { class: 'note warn' }, `${missing.length} lesson(s) from this period are not completed (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}). You may still take it, but questions come only from lessons you finished, so results are less reliable.`) : null,
        h('button', { class: 'btn', onclick: async () => { FRESH.delete(defId); const runId = uuid(); const auto = selectAutoItems(content, repo.state(), def, runId); await repo.saveDoc('assessment_run', runId, { defId, items: auto, applied: def.items.map(i => i.id), answers: {}, status: 'in_progress', startedAt: new Date().toISOString() }); draw(); } }, 'Start assessment')));
  }

  function runView(doc) {
    const run = doc.data; const key = doc.key; const idx = indexContent(content); const auto = run.items.map(id => ({ id, ...idx.items.get(id) })); const applied = def.items;
    const ans = () => (repo.getDoc('assessment_run', key) || doc).data.answers || {};
    const save = (itemId, v) => repo.updateDoc('assessment_run', key, d => { d.answers = d.answers || {}; d.answers[itemId] = { ...v, ts: Date.now() }; return d; });
    const sections = [['A', 'Quiz', auto.map(a => a.item), 'auto'], ['B', 'Decisions', applied.filter(i => i.type !== 'written'), 'applied'], ['C', 'Written', applied.filter(i => i.type === 'written'), 'applied']];
    let sec = 0; const answered = () => sections.map(s => s[2].filter(i => ans()[i.id]).length); const total = sections.map(s => s[2].length);
    const bodyEl = h('div'); const tabs = h('nav', { class: 'steps' }); const total_ = total.reduce((a, b) => a + b, 0);
    const drawTabs = () => { const a = answered(); tabs.replaceChildren(...sections.map((s, i) => h('button', { class: 'step' + (i === sec ? ' cur' : '') + (a[i] === total[i] ? ' done' : ''), onclick: () => { sec = i; drawTabs(); drawBody(); } }, h('span', { class: 'n' }, s[0]), h('span', s[1]), h('small', `${a[i]}/${total[i]}`)))); };
    const drawBody = () => {
      bodyEl.replaceChildren(); const [, name, items, kind] = sections[sec];
      if (!items.length) bodyEl.append(h('p', { class: 'muted' }, 'No items in this part.'));
      items.forEach((it, n) => {
        const got = ans()[it.id]; const skill = kind === 'auto' ? content.skills.find(s => s.id === auto[n].skillId).name : it.skills.map(x => content.skills.find(s => s.id === x).name).join(' + ');
        const card = h('section', { class: 'card ex' }, h('p', { class: 'eyebrow' }, `${name} ${n + 1} of ${items.length} · ${skill}`));
        if (got) card.append(h('p', { class: 'tag ok' }, 'Answered ✓ (locked)'));
        else card.append(renderItem(it, { hideFeedback: true, onResult: async r => { await save(it.id, { response: r.response, ms: r.durationMs, complete: r.complete !== false }); drawTabs(); const c = card.querySelector('.item'); c && c.append(h('p', { class: 'tag ok' }, 'Answer saved ✓')); } }));
        bodyEl.append(card);
      });
    };
    root.append(h('h1', def.title), h('p', { class: 'lead' }, 'In progress. You can leave and resume; answered items stay saved.'), tabs, bodyEl,
      h('section', { class: 'card' }, h('div', { class: 'row between' }, h('div', h('strong', 'Ready to submit?'), h('p', { class: 'sm muted' }, 'Unanswered items score 0 and make the attempt incomplete.')), h('button', { class: 'btn', onclick: () => submit(doc) }, 'Submit assessment')), h('button', { class: 'btn ghost sm', onclick: async () => { if (await confirmDialog('Discard this attempt and start over later? Answers on this attempt will be lost.')) { await repo.saveDoc('assessment_run', key, { ...run, status: 'discarded' }); location.hash = '#/today'; } } }, 'Discard attempt')));
    drawTabs(); drawBody();
  }

  async function submit(doc) {
    const run = (repo.getDoc('assessment_run', doc.key) || doc).data; const idx = indexContent(content); const A = run.answers || {};
    const autoRes = [], appliedRes = []; let missing = 0;
    for (const id of run.items) { const info = idx.items.get(id); const a = A[id]; if (!a) { missing++; continue; } const r = gradeItem(info.item, a.response); autoRes.push({ itemId: id, skillId: info.skillId, lessonId: info.lessonId, concept: info.item.concept, r, pct: r.pct, ms: a.ms }); }
    for (const it of def.items) { const a = A[it.id]; if (!a) { missing++; appliedRes.push({ id: it.id, type: it.type, skills: it.skills, pct: 0, answered: false }); continue; } const r = gradeItem(it, a.response); appliedRes.push({ id: it.id, type: it.type, skills: it.skills, pct: r.pct, answered: true, complete: r.complete !== false, r, it }); }
    const result = scoreAssessment({ def, autoExpected: run.items.length, auto: autoRes.map(x => ({ itemId: x.itemId, skillId: x.skillId, pct: x.pct })), applied: appliedRes, passMark: def.passMark });
    if (!result.complete && !(await confirmDialog(`${missing || 'Some'} item(s) are unanswered or a written answer is below its minimum. Submit as INCOMPLETE? It will be saved, but will not count as mastery evidence, and a retake will be recommended.`, { ok: 'Submit incomplete', cancel: 'Keep working' }))) return;
    const ctxName = 'assessment:' + doc.key;
    for (const x of autoRes) await repo.recordAttempt({ id: detId(doc.key + '|' + x.itemId), kind: 'assessment', context: ctxName, lesson_id: x.lessonId, item_id: x.itemId, skill_id: x.skillId, concept: x.concept, score: x.r.score, max_score: x.r.max, correct: x.r.correct, complete: result.complete, duration_ms: x.ms, answer: { response: x.r.correct } });
    for (const x of appliedRes.filter(a => a.answered)) await repo.recordAttempt({ id: detId(doc.key + '|' + x.id), kind: 'assessment', context: ctxName, item_id: x.id, skill_id: x.skills[0], concept: x.it.concept, score: x.r.score, max_score: x.r.max, correct: x.r.correct, complete: result.complete && x.complete, answer: { type: x.type } });
    await repo.recordAttempt({ id: detId(doc.key + '|summary'), kind: 'assessment', context: ctxName, item_id: def.id, skill_id: null, score: result.pct, max_score: 1, correct: result.passed, complete: result.complete, answer: { summary: true, parts: result.parts } });
    await repo.saveDoc('assessment_run', doc.key, { ...run, status: 'submitted', complete: result.complete, submittedAt: new Date().toISOString(), result: { pct: result.pct, parts: result.parts, weights: result.weights, passed: result.passed, weak: result.weak, skillScores: result.skillScores, passMark: def.passMark, unanswered: missing } });
    toast(result.passed ? 'Assessment passed ✓' : result.complete ? 'Assessment recorded' : 'Saved as incomplete', result.passed ? 'ok' : ''); draw();
  }

  function resultView(doc) {
    const r = doc.data.result; const run = doc.data; root.append(h('h1', def.title + ' — results'));
    root.append(h('section', { class: 'card result ' + (r.passed ? 'pass' : 'fail') }, h('p', { class: 'eyebrow' }, 'Submitted ' + fmtDate(dayKey(new Date(run.submittedAt)))), h('p', { class: 'big' }, pctText(r.pct)), h('p', r.passed ? `Passed (pass mark ${r.passMark}%).` : !run.complete ? 'Incomplete: saved, but not counted as mastery evidence. Retake when you can finish every part.' : `Below the ${r.passMark}% pass mark. Revise the weak areas below and retake.`),
      h('div', { class: 'grid3' }, [['Quiz (50%)', r.parts.auto], ['Decisions (20%)', r.parts.decision], ['Written (30%)', r.parts.written]].map(([l, v]) => h('div', h('p', { class: 'muted sm' }, l), h('p', { class: 'big sm' }, pctText(v)), bar(v))))));
    root.append(h('section', { class: 'card' }, h('h2', 'By skill'), r.skillScores.map(s => { const sk = content.skills.find(x => x.id === s.skillId); return h('div', { class: 'skrow' }, h('a', { href: '#/skill/' + s.skillId }, sk.name), bar(s.pct, { color: s.pct < 0.7 ? 'var(--bad)' : 'var(--accent)' }), h('span', pctText(s.pct)), s.pct < 0.7 ? h('a', { class: 'btn sm ghost', href: `#/practice?skill=${s.skillId}&n=6` }, 'Practise') : null); })));
    root.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { FRESH.add(defId); draw(); } }, 'Retake'), !r.passed || !run.complete ? h('p', { class: 'sm muted' }, 'Tip: do the targeted practice first.') : null, h('button', { class: 'btn ghost', onclick: async () => { const plan = repo.getDoc('plan', 'main'); const p = plan ? plan.data : { skippedDays: [] }; if (!p.skippedDays.includes(def.day)) p.skippedDays = [...p.skippedDays, def.day]; await repo.saveDoc('plan', 'main', p); toast('Moved on. This assessment stays recorded.'); location.hash = '#/today'; } }, 'Move on anyway')));
    // item review (guidance)
    const idx = indexContent(content); const det = h('details', { class: 'card' }, h('summary', 'Review your answers with guidance'));
    for (const id of run.items) { const info = idx.items.get(id); const a = (run.answers || {})[id]; if (!info) continue; const g = a ? gradeItem(info.item, a.response) : null; det.append(h('div', { class: 'rv' }, h('strong', info.item.prompt || ''), h('p', { class: 'sm' }, g ? (g.correct ? '✓ Correct' : '✗ Missed') : '○ Unanswered'), info.item.why ? mdEl(info.item.why, 'prose sm') : null)); }
    for (const it of def.items) { const a = (run.answers || {})[it.id]; det.append(h('div', { class: 'rv' }, h('strong', it.prompt || it.setup), a ? null : h('p', { class: 'sm' }, '○ Unanswered'), it.why ? mdEl(it.why, 'prose sm') : null, it.modelAnswer ? h('details', h('summary', 'Model answer'), mdEl(it.modelAnswer, 'prose sm')) : null)); }
    root.append(det);
  }
  draw(); return { el: root };
}
