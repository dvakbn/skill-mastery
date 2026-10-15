// Plan projection: the 60-day curriculum is fixed; dates slide with your progress (never lost, never piled up).
import { addDays, daysBetween } from './util.js';
export function planView(content, st, settings, today) {
  const start = settings.startDate || today; const days = content.curriculum.days;
  const runs = Object.values(st.assessmentRuns);
  const skipped = new Set((st.getDoc('plan', 'main') || {}).skippedDays || []);
  const status = d => {
    if (d.type === 'lesson') {
      const done = d.lessons.filter(id => st.lessons[id].completedAt).length;
      return done === d.lessons.length ? 'done' : done > 0 || d.lessons.some(id => st.lessons[id].started) ? 'partial' : 'todo';
    }
    const rs = runs.filter(r => r.defId === d.assessment);
    if (rs.some(r => r.status === 'submitted' && r.complete)) return 'done';
    if (skipped.has(d.day)) return 'skipped';
    if (rs.some(r => r.status === 'submitted')) return 'incomplete';
    return rs.length ? 'partial' : 'todo';
  };
  const rows = days.map(d => ({ ...d, status: status(d), original: addDays(start, d.day - 1) }));
  const pointer = (st.getDoc('plan', 'main') || {}).activeDayOverride;
  const firstOpen = rows.find(r => !['done', 'skipped'].includes(r.status));
  const activeDay = pointer && rows[pointer - 1] ? pointer : firstOpen ? firstOpen.day : 60;
  const finished = !firstOpen;
  const doneDay = new Map();
  for (const r of rows) if (r.type === 'lesson') { const ds = r.lessons.map(id => st.lessons[id].completedDay).filter(Boolean).sort(); if (ds.length === r.lessons.length) doneDay.set(r.day, ds[ds.length - 1]); }
  const activeRow = rows[activeDay - 1];
  const doneToday = activeRow && activeRow.type === 'lesson' && doneDay.get(activeDay) === today;
  for (const r of rows) {
    if (['done', 'skipped'].includes(r.status) && r.day < activeDay) r.projected = doneDay.get(r.day) || r.original;
    else r.projected = addDays(today, r.day - activeDay + (doneToday && r.day >= activeDay ? 1 : 0));
    if (r.day === activeDay && doneToday) r.projected = today;
  }
  const calendarDay = Math.min(60, Math.max(1, daysBetween(start, today) + 1));
  const completedThrough = rows.findIndex(r => !['done', 'skipped'].includes(r.status)); const completed = completedThrough === -1 ? 60 : completedThrough;
  const expected = calendarDay - 1;
  return { rows, activeDay, activeRow, doneToday, finished, calendarDay, behind: Math.max(0, expected - completed), ahead: Math.max(0, completed - expected - (doneToday ? 0 : 0)), completed, start, shift: daysBetween(rows[activeDay - 1].original, rows[activeDay - 1].projected) };
}
