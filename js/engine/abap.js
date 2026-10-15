// Pure scoring for the ABAP diagnostic. No UI, no storage: easy to test and re-run on saved answers.
// answers: { [questionId]: { choice: 0..3 | -1 } }   (-1 = "I don't know"; missing = skipped)
export const DONT_KNOW = -1;
export const STATUS_RULES = 'Strong: 80% or more correct. Developing: 50% to 79%. Weak: below 50%. Skipped questions and "I don\'t know" both count as gaps.';
export const statusOf = pct => pct >= 0.8 ? 'strong' : pct >= 0.5 ? 'developing' : 'weak';

export function scoreDiagnostic(bank, answers) {
  const qs = bank.questions; const a = answers || {};
  const kindOf = q => { const r = a[q.id]; if (!r || r.choice === undefined || r.choice === null) return 'skipped'; if (r.choice === DONT_KNOW) return 'gap'; return r.choice === q.answer ? 'correct' : 'misconception'; };
  const rows = qs.map(q => ({ q, kind: kindOf(q) }));
  const tally = list => { const t = { total: list.length, correct: 0, gap: 0, misconception: 0, skipped: 0 }; for (const r of list) t[r.kind]++; t.pct = t.total ? t.correct / t.total : 0; return t; };
  const overall = tally(rows);
  const byTopic = bank.topics.map(tp => { const t = tally(rows.filter(r => r.q.topic === tp.id)); return { id: tp.id, label: tp.label, ...t, status: statusOf(t.pct) }; });
  const byLevel = [1, 2, 3].map(l => ({ level: l, ...tally(rows.filter(r => r.q.level === l)) }));
  // Ceiling: the hardest level at which you still answer at least 60% correctly (0 = not even level 1).
  let ceiling = 0; for (const l of byLevel) { if (l.total && l.pct >= 0.6) ceiling = l.level; else break; }
  const missed = rows.filter(r => r.kind !== 'correct').map(r => ({ id: r.q.id, topic: r.q.topic, tag: r.q.tag, level: r.q.level, kind: r.kind }));
  const answered = rows.filter(r => r.kind !== 'skipped').length;
  return { overall, byTopic, byLevel, ceiling, missed, answered, complete: answered === qs.length };
}

// Plain-text summary a person can paste into a chat or note. Contains no personal data.
export function summaryText(bank, res, dateKey) {
  const pc = x => Math.round(x * 100) + '%'; const L = [];
  L.push(`ABAP DIAGNOSTIC ${dateKey}: ${res.overall.correct}/${res.overall.total} (${pc(res.overall.pct)}), answered ${res.answered}/${res.overall.total}`);
  L.push(`Levels: ` + res.byLevel.map(l => `L${l.level} ${l.correct}/${l.total}`).join(', ') + `; level reached: ${res.ceiling || 'below L1'}`);
  L.push('Topics (weakest first):');
  for (const t of [...res.byTopic].sort((a, b) => a.pct - b.pct)) L.push(`- ${t.label}: ${t.correct}/${t.total} ${t.status} (wrong ${t.misconception}, don't know ${t.gap}, skipped ${t.skipped})`);
  const kinds = { misconception: 'Answered wrong', gap: "Said don't know", skipped: 'Skipped' };
  for (const k of Object.keys(kinds)) { const m = res.missed.filter(x => x.kind === k); if (m.length) L.push(`${kinds[k]}: ` + m.map(x => `${x.tag} (L${x.level})`).join('; ')); }
  return L.join('\n');
}
