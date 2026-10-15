import { h, pctText, toast } from '../ui/lib.js';
import { renderItem, renderCard } from '../ui/items.js';
import { buildReviewQueue, buildPractice } from '../engine/recommend.js';

function runSession(ctx, { title, intro, entries, context }) {
  const { repo } = ctx; const root = h('div', { class: 'view session' }); const box = h('div'); const results = [];
  root.append(h('a', { href: '#/today', class: 'back' }, '← Today'), h('h1', title), intro ? h('p', { class: 'lead' }, intro) : null, box);
  if (!entries.length) { box.append(h('section', { class: 'card' }, h('h2', 'Nothing to do right now ✓'), h('p', 'No items are due. Reviews appear the day after you complete a lesson, then at growing intervals.'), h('a', { class: 'btn', href: '#/today' }, 'Back to Today'))); return { el: root }; }
  let i = 0; const prog = h('div', { class: 'bar' }, h('i')); box.append(prog);
  const stage = h('div'); box.append(stage);
  const show = () => {
    prog.firstChild.style.width = (i / entries.length * 100) + '%'; stage.replaceChildren();
    if (i >= entries.length) {
      const ok = results.filter(r => r.correct).length; const missed = entries.filter((e, k) => !results[k].correct);
      stage.append(h('section', { class: 'card' }, h('h2', 'Session complete'), h('p', { class: 'big' }, `${ok} / ${entries.length}`), h('p', pctText(ok / entries.length) + ' correct. Missed items return tomorrow; others return after a longer gap.'),
        missed.length ? h('details', { open: true }, h('summary', 'Revisit what you missed'), h('ul', missed.map(m => h('li', m.pool === 'card' ? m.item.front : m.item.prompt)))) : null,
        h('div', { class: 'row end' }, h('a', { class: 'btn ghost', href: '#/today' }, 'Back to Today'), h('a', { class: 'btn', href: '#/review' }, 'Check for more'))));
      return;
    }
    const e = entries[i]; const skillName = ctx.content.skills.find(s => s.id === e.skillId).name;
    const done = async r => {
      results[i] = r; const isCard = e.pool === 'card';
      await repo.recordAttempt({ kind: isCard ? 'card' : 'review', context, lesson_id: e.lessonId, item_id: e.id, skill_id: e.skillId, concept: e.item.concept, score: r.score, max_score: r.max, correct: r.correct, duration_ms: r.durationMs, answer: isCard ? { quality: r.response.quality } : { type: e.item.type, response: r.response } });
      stage.firstChild.append(h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => { i++; show(); }, autofocus: true }, i + 1 < entries.length ? 'Next' : 'Finish')));
    };
    stage.append(h('section', { class: 'card' }, h('p', { class: 'eyebrow' }, `${i + 1} of ${entries.length} · ${skillName}`), e.pool === 'card' ? renderCard(e.item, { onResult: done }) : renderItem(e.item, { onResult: done })));
  };
  show(); return { el: root };
}
export function reviewView(ctx) {
  const st = ctx.repo.state(); const { queue, backlog, total } = buildReviewQueue(st, ctx.repo.settings(), st.today);
  return runSession(ctx, { title: 'Spaced review', intro: `${queue.length} item${queue.length === 1 ? '' : 's'} due${backlog ? ` · ${backlog} more will roll over (cap ${ctx.repo.settings().reviewCap}; change in Settings)` : ''}. Answer from memory.`, entries: queue, context: 'review' });
}
export function practiceView(ctx, params) {
  const st = ctx.repo.state(); const n = parseInt(params.n || 5);
  const entries = buildPractice(ctx.content, st, { skillId: params.skill, concept: params.concept, n, seed: st.today + (params.skill || '') + (params.concept || '') });
  const label = params.concept ? (st.mistakes.find(m => m.concept === params.concept) || {}).label || params.concept : (ctx.content.skills.find(s => s.id === params.skill) || {}).name;
  return runSession(ctx, { title: `Targeted practice: ${label}`, intro: 'Questions chosen from your weakest concepts first. Two correct answers in a row clears a recurring mistake.', entries, context: params.concept ? 'drill' : 'remedial' });
}
