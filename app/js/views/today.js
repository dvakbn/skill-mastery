import { h, pctText, fmtDateLong, fmtDate, toast, bar, mdEl } from '../ui/lib.js';
import { planView } from '../engine/schedule.js';
import { recommend, buildReviewQueue } from '../engine/recommend.js';
import { dayKey, words, addDays } from '../engine/util.js';
import { detId } from '../repo.js';

export function todayView(ctx) {
  const { repo, content } = ctx; const today = dayKey(); const st = repo.state(today); const settings = repo.settings();
  const plan = planView(content, st, settings, today); const root = h('div', { class: 'view today' });
  const overrides = {}; for (const d of repo.docs) if (d.kind === 'override' && !d.deleted) overrides[d.key] = d.data;
  const recs = recommend({ content, st, plan, settings, overrides, today });
  const row = plan.activeRow; const { queue } = buildReviewQueue(st, settings, today);
  const dayNo = plan.activeDay;
  root.append(h('header', { class: 'thead' }, h('div', h('p', { class: 'eyebrow' }, fmtDateLong(today)), h('h1', plan.finished ? 'Curriculum complete 🎓' : `Day ${dayNo} of 60`), h('p', { class: 'lead' }, content.curriculum.weeks[row.week - 1].theme + ' · week ' + row.week)),
    h('div', { class: 'kpis' }, h('div', h('b', st.stats.streak), h('span', 'day streak')), h('div', h('b', st.stats.due), h('span', 'reviews due')), h('div', h('b', `${st.stats.completedLessons}/${st.stats.totalLessons}`), h('span', 'lessons')))));
  if (plan.behind >= 2) root.append(h('div', { class: 'note warn' }, `You are ${plan.behind} days behind the calendar. Nothing is lost: today's lessons are still the next step and the plan dates have moved ${plan.shift} day(s) later.`));
  // Recommendations (reviewable and overridable)
  if (recs.length) {
    const box = h('section', { class: 'card recs' }, h('h2', 'Recommended for you'), h('p', { class: 'sm muted' }, 'Chosen by transparent rules (see Settings → How it works). You decide: accept, snooze or dismiss.'));
    for (const r of recs.slice(0, 5)) box.append(h('div', { class: 'rec' }, h('div', h('strong', r.title), h('p', { class: 'sm' }, r.reason), h('p', { class: 'sm muted' }, `Rule ${r.rule}` + (r.minutes ? ` · ~${r.minutes} min` : ''))),
      h('div', { class: 'row' }, r.route ? h('a', { class: 'btn sm', href: r.route }, 'Do it') : null, h('button', { class: 'btn ghost sm', onclick: async () => { await repo.saveDoc('override', r.id, { state: 'dismissed', until: addDays(today, 1), at: new Date().toISOString() }); toast('Snoozed until tomorrow'); ctx.rerender(); } }, 'Snooze'), h('button', { class: 'btn ghost sm', onclick: async () => { await repo.saveDoc('override', r.id, { state: 'dismissed', at: new Date().toISOString() }); ctx.rerender(); } }, 'Dismiss'))));
    root.append(box);
  }
  const agenda = h('section', { class: 'card agenda' }); root.append(agenda);
  const item = (title, sub, mins, status, href, cta) => h('a', { class: 'ag ' + status, href }, h('span', { class: 'dot' }), h('span', { class: 'ag-t' }, h('strong', title), h('small', sub)), h('span', { class: 'ag-m' }, mins ? mins + ' min' : ''), h('span', { class: 'ag-c' }, cta));
  const tpl = content.curriculum.dailyTemplate; let total = 0;
  const showDay = (d, label) => {
    agenda.append(h('h2', label));
    if (d.type === 'lesson') {
      const revMin = Math.max(2, Math.round(queue.length * 0.65));
      agenda.append(item('Warm-up review', queue.length ? `${queue.length} items due` : 'Nothing due yet', queue.length ? revMin : 0, queue.length ? 'todo' : 'idle', '#/review', queue.length ? 'Start' : '—'));
      for (const id of d.lessons) { const L = content.lessons[id]; const p = st.lessons[id]; const sk = content.skills.find(s => s.id === L.skillId);
        const status = p.completedAt ? 'done' : p.started ? 'partial' : 'todo'; total += tpl.lessonEach;
        agenda.append(item(L.title, `${sk.name} · lesson ${L.n}`, tpl.lessonEach, status, '#/lesson/' + id, p.completedAt ? 'Review' : p.started ? 'Resume' : 'Start')); }
      const ref = repo.getDoc('reflection', today); agenda.append(item('Daily reflection', ref ? 'Saved ✓' : 'Rate your day and write three lines', tpl.reflection, ref ? 'done' : 'todo', '#/reflect', ref ? 'Edit' : 'Write'));
      agenda.append(h('p', { class: 'sm muted' }, `About ${queue.length ? Math.round(queue.length * 0.65) : 0} + ${d.lessons.length * tpl.lessonEach} + ${tpl.reflection} ≈ ${Math.max(0, (queue.length ? Math.round(queue.length * 0.65) : 0)) + d.lessons.length * tpl.lessonEach + tpl.reflection} minutes today.`));
    } else {
      const def = content.assessments[d.assessment]; const wk = d.type === 'final' ? 'Final assessment' : `Week ${d.week} assessment`;
      agenda.append(item(wk, def ? def.title : 'Assessment', 45, d.status === 'done' ? 'done' : d.status === 'incomplete' ? 'partial' : 'todo', '#/assessment/' + d.assessment, d.status === 'done' ? 'Results' : d.status === 'incomplete' ? 'Retake' : d.status === 'partial' ? 'Resume' : 'Start'));
      const ref = repo.getDoc('reflection', today); agenda.append(item('Weekly reflection', ref ? 'Saved ✓' : 'Look back on the week', 6, ref ? 'done' : 'todo', '#/reflect', ref ? 'Edit' : 'Write'));
    }
  };
  showDay(row, plan.doneToday ? "Today's plan (completed)" : "Today's plan");
  if ((plan.doneToday || row.status === 'done') && !plan.finished) { const nx = plan.rows[Math.min(59, plan.activeDay)]; if (nx && nx.day !== row.day) { agenda.append(h('hr')); showDay(nx, 'Study ahead (optional)'); } }
  root.append(h('section', { class: 'card' }, h('h2', 'Your skills this week'), h('div', { class: 'chips' }, content.curriculum.weeks[row.week - 1].skills.map(sid => { const s = content.skills.find(x => x.id === sid), m = st.mastery[sid]; return h('a', { class: 'chip', href: '#/skill/' + sid }, s.name, h('small', ` L${m.level}`)); }))));
  return { el: root };
}
export function reflectView(ctx) {
  const { repo, content } = ctx; const today = dayKey(); const st = repo.state(today); const plan = planView(content, st, repo.settings(), today);
  const prev = (repo.getDoc('reflection', today) || { data: {} }).data; const d = { mood: prev.mood || 0, energy: prev.energy || 0, focus: prev.focus || 0, learned: prev.learned || '', hard: prev.hard || '', commit: prev.commit || '', lesson: prev.lesson || '' };
  const row = plan.activeRow; const todayLessons = Object.values(st.lessons).filter(l => l.completedDay === today).map(l => content.lessons[l.id]).filter(Boolean);
  const prompt = todayLessons[0] ? todayLessons[0].reflection : row.lessons[0] && content.lessons[row.lessons[0]] ? content.lessons[row.lessons[0]].reflection : 'What is one thing you want to remember from this week?';
  const root = h('div', { class: 'view' }, h('a', { href: '#/today', class: 'back' }, '← Today'), h('h1', 'Daily reflection'), h('p', { class: 'lead' }, 'Three minutes. Specific beats long.'));
  const scale = (key, label) => h('fieldset', { class: 'scale' }, h('legend', label), [1, 2, 3, 4, 5].map(n => h('label', h('input', { type: 'radio', name: key, value: n, checked: d[key] === n || null, onchange: () => d[key] = n }), h('span', n))));
  const ta = (key, label, ph, rows = 3) => h('label', { class: 'field' }, h('span', label), h('textarea', { class: 'txt', rows, placeholder: ph, oninput: e => d[key] = e.target.value }, d[key]));
  const form = h('section', { class: 'card' }, scale('mood', 'Mood (1 low – 5 high)'), scale('energy', 'Energy'), scale('focus', 'Focus'), ta('lesson', prompt, 'Your answer'), ta('learned', 'One thing I learned or practised today', 'Be specific'), ta('hard', 'What was hard, and why?', 'Name the exact point'), ta('commit', 'One concrete commitment for tomorrow', 'When, where, what'),
    h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: async () => { if (!d.mood || !d.energy || !d.focus) { toast('Please rate mood, energy and focus'); return; } if (words(d.lesson + ' ' + d.learned + ' ' + d.commit) < 8) { toast('Write at least a few words so this is useful later'); return; }
      await repo.saveDoc('reflection', today, d); await repo.recordAttempt({ id: detId('reflection|' + today), kind: 'reflection', context: 'daily', item_id: 'reflection.' + today, skill_id: null, score: 1, max_score: 1, correct: true, answer: { words: words(d.lesson + d.learned + d.hard + d.commit) } }); toast('Reflection saved ✓', 'ok'); location.hash = '#/today'; } }, 'Save reflection')));
  root.append(form);
  const past = repo.docs.filter(x => x.kind === 'reflection' && !x.deleted && x.key !== today).sort((a, b) => a.key < b.key ? 1 : -1).slice(0, 5);
  if (past.length) root.append(h('section', { class: 'card' }, h('h2', 'Recent reflections'), past.map(p => h('div', { class: 'past' }, h('strong', fmtDate(p.key)), ` · mood ${p.data.mood}, energy ${p.data.energy}, focus ${p.data.focus}`, p.data.commit ? h('p', { class: 'sm' }, 'Commitment: ' + p.data.commit) : null))));
  return { el: root };
}
