// Spaced repetition: SM-2 variant, replayed deterministically from attempts.
import { addDays, dayKey } from './util.js';
export const SRS_RULES = 'Each item has an ease (starts 2.5) and an interval. A good answer (quality ≥3) grows the interval: 1 day, then 3 days, then interval × ease. A miss resets to 1 day and lowers ease (never below 1.3). Items due today or overdue form your review queue, most overdue and weakest first.';
export const newState = (due) => ({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due, last: null, seen: 0 });
export function update(st, quality, today) {
  const s = { ...st, seen: (st.seen || 0) + 1, last: today };
  if (quality < 3) { s.reps = 0; s.lapses = (st.lapses || 0) + 1; s.interval = 1; s.ease = Math.max(1.3, st.ease - 0.2); }
  else {
    s.reps = st.reps + 1;
    s.interval = s.reps === 1 ? 1 : s.reps === 2 ? 3 : Math.max(st.interval + 1, Math.round(st.interval * st.ease));
    if (quality === 5) s.interval = Math.round(s.interval * 1.3);
    s.ease = Math.max(1.3, st.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    s.interval = Math.min(s.interval, 180);
  }
  s.due = addDays(today, s.interval);
  return s;
}
// Retrievability proxy 0..1 for display
export function strength(st, today) { if (!st || !st.reps) return 0; return Math.min(1, st.interval / 21); }
