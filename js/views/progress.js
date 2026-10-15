import { h, pctText, bar, lineChart, heatmap, fmtDate } from '../ui/lib.js';
import { dayKey, addDays, daysBetween, avg } from '../engine/util.js';
import { planView } from '../engine/schedule.js';
export function progressView(ctx) {
  const { repo, content } = ctx; const st = repo.state(); const today = st.today; const root = h('div', { class: 'view' }, h('h1', 'Progress'));
  const ms = content.skills.map(s => st.mastery[s.id]); const scored = ms.filter(m => m.score != null);
  root.append(h('div', { class: 'tiles' }, [[`${st.stats.completedLessons}/${st.stats.totalLessons}`, 'Lessons completed'], [scored.length ? pctText(avg(scored.map(m => m.score))) : '—', 'Average mastery score'], [ms.filter(m => m.level >= 3).length + '/26', 'Skills Proficient+'], [st.stats.streak, 'Day streak (best ' + st.stats.bestStreak + ')'], [st.stats.reviewsDone, 'Reviews done'], [st.mistakes.filter(m => m.status === 'recurring').length, 'Recurring mistakes']].map(([v, l]) => h('div', { class: 'tile' }, h('b', v), h('span', l)))));
  // Daily score trend (last 30 days, 3-day buckets)
  const labels = [], pts = []; for (let i = 9; i >= 0; i--) { const to = i * 3, from = to + 2; const xs = st.attempts.filter(a => a.complete !== false && ['quiz', 'exercise', 'review', 'assessment', 'card'].includes(a.kind) && !(a.answer && a.answer.summary)).filter(a => { const g = daysBetween(dayKey(new Date(a.client_ts)), today); return g >= to && g <= from; }); labels.push(fmtDate(addDays(today, -from)).replace(/^\w+ /, '')); pts.push({ x: labels[labels.length - 1], y: xs.length ? avg(xs.map(a => a.score / a.max_score)) : null }); }
  const asm = Object.values(st.assessmentRuns).filter(r => r.status === 'submitted' && r.complete).sort((a, b) => a.submittedAt < b.submittedAt ? -1 : 1);
  root.append(h('section', { class: 'card' }, h('h2', 'Score trend (30 days)'), pts.some(p => p.y != null) ? lineChart([{ name: 'Average score', color: 'var(--accent)', points: pts }], { labels }) : h('p', { class: 'muted' }, 'Appears after your first scored answers.')));
  root.append(h('section', { class: 'card' }, h('h2', 'Assessment results'), asm.length ? h('div', { class: 'row wrap' }, asm.map(r => h('div', { class: 'tile ' + (r.result.passed ? 'pass' : 'fail') }, h('b', pctText(r.result.pct)), h('span', r.defId === 'final' ? 'Final' : 'Week ' + r.defId.replace('week-', ''))))) : h('p', { class: 'muted' }, 'No completed assessments yet. Your first is on Day 7.')));
  // completion vs mastery by skill
  const sec = h('section', { class: 'card' }, h('h2', 'Completion vs mastery'), h('p', { class: 'sm muted' }, 'Light bar: lessons completed. Dark bar: mastery score. A big gap means you finished lessons but have not yet shown the skill.'));
  for (const g of content.groups) { sec.append(h('h3', { class: 'gh', style: `--g:${g.color}` }, g.name)); for (const s of content.skills.filter(x => x.group === g.id)) { const m = st.mastery[s.id]; sec.append(h('a', { class: 'skrow', href: '#/skill/' + s.id }, h('span', s.name), h('div', { class: 'dual' }, bar(m.completion, { color: 'var(--accent-soft)' }), bar(m.score || 0, { color: g.color })), h('span', { class: 'sm' }, `L${m.level} · ${pctText(m.score)}`))); } }
  root.append(sec);
  // heatmap 16 weeks ending this week
  const start = addDays(today, -(15 * 7) - ((new Date(today + 'T12:00:00').getDay() + 6) % 7)); const days = Array.from({ length: 16 * 7 }, (_, i) => addDays(start, i)); const counts = new Map([...st.activeDays].map(([k, v]) => [k, v.n]));
  root.append(h('section', { class: 'card' }, h('h2', 'Activity (16 weeks)'), h('div', { class: 'scrollx' }, heatmap(counts, days)), h('p', { class: 'sm muted' }, `${st.stats.activeDays} active day(s) in total.`)));
  root.append(h('section', { class: 'card' }, h('h2', 'Milestones'), h('div', { class: 'miles' }, st.milestones.map(m => h('div', { class: 'mile' + (m.done ? ' done' : '') }, m.done ? '★ ' : '☆ ', m.title)))));
  return { el: root };
}
export function historyView(ctx) {
  const { repo, content } = ctx; const st = repo.state(); const root = h('div', { class: 'view' }, h('h1', 'History'), h('p', { class: 'lead' }, 'Every attempt you have made, stored on this device and synced to your account.'));
  const fSkill = h('select', { onchange: draw }, h('option', { value: '' }, 'All skills'), content.skills.map(s => h('option', { value: s.id }, s.name))); const fKind = h('select', { onchange: draw }, h('option', { value: '' }, 'All types'), ['quiz', 'exercise', 'review', 'card', 'assessment', 'task', 'reflection'].map(k => h('option', k)));
  const list = h('div', { class: 'card' }); root.append(h('div', { class: 'row' }, fSkill, fKind), list);
  function draw() { const rows = st.attempts.filter(a => (!fSkill.value || a.skill_id === fSkill.value) && (!fKind.value || a.kind === fKind.value)).slice().reverse().slice(0, 200); list.replaceChildren(h('p', { class: 'sm muted' }, `Showing ${rows.length} of ${st.attempts.length} (latest 200 max)`), h('div', { class: 'tablewrap' }, h('table', h('tr', ['When', 'Skill', 'Type', 'Item', 'Score', 'Status'].map(x => h('th', x))), rows.map(a => h('tr', h('td', new Date(a.client_ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })), h('td', (content.skills.find(s => s.id === a.skill_id) || {}).name || '—'), h('td', a.kind + (a.context && a.context !== 'lesson' ? ` (${a.context.split(':')[0]})` : '')), h('td', { class: 'mono' }, a.item_id || '—'), h('td', pctText(a.score / a.max_score)), h('td', a.complete === false ? 'incomplete' : a.correct === false ? 'missed' : 'ok')))))); }
  draw();
  const refl = repo.docs.filter(d => d.kind === 'reflection' && !d.deleted).sort((a, b) => a.key < b.key ? 1 : -1).slice(0, 14);
  root.append(h('section', { class: 'card' }, h('h2', 'Reflections'), refl.length ? refl.map(r => h('details', h('summary', fmtDate(r.key), ` · mood ${r.data.mood} · energy ${r.data.energy} · focus ${r.data.focus}`), h('p', r.data.lesson), h('p', h('strong', 'Learned: '), r.data.learned), h('p', h('strong', 'Hard: '), r.data.hard), h('p', h('strong', 'Commitment: '), r.data.commit))) : h('p', { class: 'muted' }, 'No reflections yet.')));
  return { el: root };
}
