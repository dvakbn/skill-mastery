import { h, fmtDate, toast, confirmDialog, bar } from '../ui/lib.js';
import { planView } from '../engine/schedule.js';
import { dayKey } from '../engine/util.js';
export function planViewUI(ctx) {
  const { repo, content } = ctx; const today = dayKey(); const st = repo.state(today); const plan = planView(content, st, repo.settings(), today); const root = h('div', { class: 'view' });
  root.append(h('h1', '60-day plan'), h('p', { class: 'lead' }, `Day ${plan.activeDay} is next. ${plan.behind ? `You are ${plan.behind} day(s) behind the original calendar; dates below have slid forward so nothing is lost.` : plan.ahead ? `You are ${plan.ahead} day(s) ahead.` : 'You are on schedule.'}`),
    h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', onclick: async () => { const p = (repo.getDoc('plan', 'main') || { data: { skippedDays: [] } }).data; delete p.activeDayOverride; await repo.saveDoc('plan', 'main', p); toast('Following automatic order'); ctx.rerender(); } }, 'Reset to automatic order')));
  for (const w of content.curriculum.weeks) {
    const rows = w.days.map(d => plan.rows[d - 1]); const doneN = rows.filter(r => ['done', 'skipped'].includes(r.status)).length;
    const sec = h('section', { class: 'card week' }, h('div', { class: 'row between' }, h('div', h('h2', `Week ${w.week}`), h('p', { class: 'sm muted' }, w.theme)), h('span', { class: 'tag' }, `${doneN}/${rows.length} days`)), bar(doneN / rows.length));
    for (const r of rows) {
      const lessons = r.lessons.map(id => content.lessons[id] ? content.lessons[id].title : id); const label = r.type === 'lesson' ? lessons.join(' + ') : r.type === 'final' ? 'Final assessment and capstone' : `Week ${r.week} assessment`;
      const href = r.type === 'lesson' ? '#/lesson/' + r.lessons[0] : '#/assessment/' + r.assessment;
      sec.append(h('div', { class: 'day ' + r.status + (r.day === plan.activeDay ? ' active' : '') }, h('span', { class: 'dn' }, 'Day ' + r.day), h('span', { class: 'dl' }, h('strong', label), h('small', fmtDate(r.projected) + (r.projected !== r.original && r.status !== 'done' ? ` (was ${fmtDate(r.original)})` : ''))), h('span', { class: 'ds tag ' + r.status }, { done: 'Done', partial: 'In progress', todo: r.day === plan.activeDay ? 'Next' : 'Upcoming', skipped: 'Skipped', incomplete: 'Retake advised' }[r.status]),
        h('span', { class: 'row' }, r.type === 'lesson' ? r.lessons.map((id, i) => h('a', { class: 'btn sm ghost', href: '#/lesson/' + id }, r.lessons.length > 1 ? 'Lesson ' + (i + 1) : 'Open')) : h('a', { class: 'btn sm ghost', href }, 'Open'), r.day !== plan.activeDay && !['done', 'skipped'].includes(r.status) ? h('button', { class: 'btn sm ghost', title: 'Make this the next day', onclick: async () => { const p = (repo.getDoc('plan', 'main') || { data: { skippedDays: [] } }).data; p.activeDayOverride = r.day; await repo.saveDoc('plan', 'main', p); toast('Day ' + r.day + ' is now next'); ctx.rerender(); } }, 'Jump here') : null)));
    }
    root.append(sec);
  }
  return { el: root };
}
