import { h, pctText, bar, sparkline, mdEl, fmtDate } from '../ui/lib.js';
import { LEVELS, MASTERY_RULES } from '../engine/derive.js';
import { dayKey, addDays, daysBetween } from '../engine/util.js';
const lvlColor = l => ['var(--line)', 'var(--l1)', 'var(--l2)', 'var(--l3)', 'var(--l4)'][l];
export function skillsView(ctx) {
  const { repo, content } = ctx; const st = repo.state(); const root = h('div', { class: 'view' }, h('h1', 'Skills'), h('p', { class: 'lead' }, 'Two separate measures: lessons completed, and mastery demonstrated by your results.'));
  for (const g of content.groups) {
    root.append(h('h2', { class: 'gh', style: `--g:${g.color}` }, g.name));
    const grid = h('div', { class: 'grid' });
    for (const s of content.skills.filter(s => s.group === g.id)) { const m = st.mastery[s.id];
      grid.append(h('a', { class: 'card skill', href: '#/skill/' + s.id, style: `--g:${g.color}` }, h('div', { class: 'row between' }, h('strong', s.name), h('span', { class: 'lvl', style: `background:${lvlColor(m.level)}` }, `L${m.level}`)), h('p', { class: 'sm muted' }, m.levelName), h('div', { class: 'two' }, h('div', h('small', `Completed ${m.done}/${m.total}`), bar(m.completion)), h('div', h('small', `Mastery ${pctText(m.score)}`), bar(m.score || 0, { color: 'var(--g)' }))), m.recurring ? h('p', { class: 'tag bad' }, `${m.recurring} recurring mistake${m.recurring > 1 ? 's' : ''}`) : null)); }
    root.append(grid);
  }
  return { el: root };
}
export function skillDetailView(ctx, id) {
  const { repo, content } = ctx; const st = repo.state(); const s = content.skills.find(x => x.id === id); const root = h('div', { class: 'view' });
  if (!s) { root.append(h('h1', 'Unknown skill')); return { el: root }; } const m = st.mastery[id]; const today = st.today;
  root.append(h('a', { class: 'back', href: '#/skills' }, '← Skills'), h('h1', s.name), h('p', { class: 'lead' }, s.description));
  root.append(h('section', { class: 'card' }, h('div', { class: 'grid3' }, h('div', h('p', { class: 'muted sm' }, 'Level'), h('p', { class: 'big sm' }, `L${m.level} · ${m.levelName}`)), h('div', h('p', { class: 'muted sm' }, 'Mastery score'), h('p', { class: 'big sm' }, pctText(m.score)), h('p', { class: 'sm muted' }, m.trend == null ? '' : (m.trend >= 0 ? '▲ ' : '▼ ') + Math.round(Math.abs(m.trend) * 100) + ' pts vs prior 2 weeks')), h('div', h('p', { class: 'muted sm' }, 'Lessons completed'), h('p', { class: 'big sm' }, `${m.done}/${m.total}`))),
    h('h3', m.level < 4 ? `To reach ${LEVELS[m.level + 1]}` : 'Mastered'), m.level < 4 ? h('ul', { class: 'reqs' }, m.needs.map(n => h('li', { class: n.ok ? 'ok' : '' }, (n.ok ? '✓ ' : '○ ') + n.text))) : h('p', 'All mastery requirements are met. Keep reviews going to hold this level.')));
  // trend over weeks
  const evs = st.attempts.filter(a => a.skill_id === id && a.complete !== false && !['task', 'reflection'].includes(a.kind) && !(a.answer && a.answer.summary)); const weeks = Array.from({ length: 8 }, (_, i) => { const to = daysBetween(addDays(today, -(7 * (7 - i)) - 6), today), from = daysBetween(addDays(today, -(7 * (7 - i))), today); const xs = evs.filter(a => { const g = daysBetween(dayKey(new Date(a.client_ts)), today); return g <= to && g >= from; }); return xs.length ? xs.reduce((q, a) => q + a.score / a.max_score, 0) / xs.length : null; });
  root.append(h('section', { class: 'card' }, h('h2', 'Weekly trend (8 weeks)'), sparkline(weeks, { w: 320, h: 60 }), h('p', { class: 'sm muted' }, `${m.attempts} scored attempts across ${m.evidenceDays} day(s).`)));
  root.append(h('section', { class: 'card' }, h('h2', 'Lessons'), s.lessons.map(l => { const lid = `${id}-${l.n}`; const p = st.lessons[lid]; const day = content.curriculum.lessonDay[lid]; return h('div', { class: 'lrow' }, h('span', { class: 'tag ' + (p.completedAt ? 'ok' : '') }, p.completedAt ? '✓' : p.started ? '…' : '○'), h('span', h('strong', `${l.n}. ${l.title}`), h('small', ` Day ${day}`)), content.lessons[lid] ? h('a', { class: 'btn sm ghost', href: '#/lesson/' + lid }, p.completedAt ? 'Revisit' : 'Open') : null); })));
  const ms = st.mistakes.filter(x => x.skillId === id);
  root.append(h('section', { class: 'card' }, h('h2', 'Concept health'), ms.length ? ms.map(x => h('div', { class: 'mrow' }, h('span', { class: 'tag ' + (x.status === 'recurring' ? 'bad' : x.status === 'resolved' ? 'ok' : '') }, x.status), h('span', x.label, h('small', ` missed ${x.misses}× · last ${fmtDate(x.lastMiss)}`)), x.status !== 'resolved' ? h('a', { class: 'btn sm ghost', href: '#/practice?concept=' + encodeURIComponent(x.concept) }, 'Drill') : null)) : h('p', { class: 'muted' }, 'No mistakes recorded yet.'), h('a', { class: 'btn ghost sm', href: `#/practice?skill=${id}&n=6` }, 'Practise this skill')));
  const log = evs.slice(-8).reverse(); root.append(h('section', { class: 'card' }, h('h2', 'Recent evidence'), log.length ? log.map(a => h('div', { class: 'ev' }, h('span', fmtDate(dayKey(new Date(a.client_ts)))), h('span', { class: 'tag' }, a.kind), h('span', pctText(a.score / a.max_score)))) : h('p', { class: 'muted' }, 'Nothing yet.')));
  return { el: root };
}
export function mistakesView(ctx) {
  const st = ctx.repo.state(); const root = h('div', { class: 'view' }, h('h1', 'Mistakes'), h('p', { class: 'lead' }, 'Recurring = missed at least twice on separate days (or 3 times) and not yet answered correctly twice in a row. Clear them with targeted drills.'));
  const groups = [['recurring', 'Recurring'], ['watch', 'Watch list'], ['resolved', 'Resolved']];
  for (const [k, label] of groups) { const xs = st.mistakes.filter(m => m.status === k); root.append(h('section', { class: 'card' }, h('h2', `${label} (${xs.length})`), xs.length ? xs.map(m => { const sk = ctx.content.skills.find(s => s.id === m.skillId); return h('div', { class: 'mrow' }, h('span', h('strong', m.label), h('small', ` ${sk ? sk.name : ''} · missed ${m.misses}× of ${m.attempts} · correct streak ${m.correctStreak}`)), k !== 'resolved' ? h('a', { class: 'btn sm', href: '#/practice?concept=' + encodeURIComponent(m.concept) }, 'Drill 5') : null); }) : h('p', { class: 'muted' }, k === 'recurring' ? 'None. Nice.' : 'Nothing here.'))); }
  return { el: root };
}
