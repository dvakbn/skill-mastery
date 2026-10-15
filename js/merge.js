// Conflict resolution rules per document kind. Each merger is deterministic and commutative so
// two devices that exchange documents converge to the same result.
const minDefined = (...xs) => xs.filter(Boolean).sort()[0] || null;
const lww = (l, r, lt, rt) => (lt >= rt ? l : r);
export const STATUS_ORDER = { in_progress: 0, submitted: 1 };
const MERGERS = {
  // fields carry their own timestamps: newest write per field wins
  settings: (l, r) => { const v = { ...r.v }, ts = { ...r.ts }; for (const k of Object.keys(l.v)) if ((l.ts[k] || 0) >= (ts[k] || 0)) { v[k] = l.v[k]; ts[k] = l.ts[k] || 0; } return { v, ts }; },
  // progress only moves forward: union of sections, earliest timestamps
  lesson: (l, r) => { const sections = { ...r.sections }; for (const [k, t] of Object.entries(l.sections || {})) sections[k] = minDefined(t, sections[k]); const sorted = Object.fromEntries(Object.entries(sections).sort(([a], [b]) => (a < b ? -1 : 1))); return { ...r, ...l, sections: sorted, startedAt: minDefined(l.startedAt, r.startedAt), completedAt: minDefined(l.completedAt, r.completedAt) }; },
  task: (l, r) => { const n = Math.max((l.checked || []).length, (r.checked || []).length); const checked = Array.from({ length: n }, (_, i) => !!((l.checked || [])[i] || (r.checked || [])[i])); const useL = (l.evidenceTs || 0) >= (r.evidenceTs || 0); return { checked, evidence: (useL ? l : r).evidence || '', evidenceTs: Math.max(l.evidenceTs || 0, r.evidenceTs || 0), completedAt: minDefined(l.completedAt, r.completedAt) }; },
  assessment_run: (l, r) => {
    const submitted = [l, r].filter(x => x.status === 'submitted').sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1))[0];
    if (submitted) return submitted; // first completed submission is final (attempt ids are deterministic, so no duplicates)
    const answers = { ...r.answers }; for (const [k, a] of Object.entries(l.answers || {})) if (!answers[k] || (a.ts || 0) >= (answers[k].ts || 0)) answers[k] = a;
    return { ...r, ...l, answers, items: l.items && l.items.length ? l.items : r.items };
  },
  plan: (l, r, lt, rt) => { const base = lww(l, r, lt, rt); return { ...base, skippedDays: [...new Set([...(l.skippedDays || []), ...(r.skippedDays || [])])].sort((a, b) => a - b) }; }
};
// returns {data, lost}: lost = the losing side for last-writer-wins kinds (kept in the conflict log)
export function mergeDocs(kind, local, remote) {
  const lt = local.updated_at, rt = remote.updated_at;
  if (MERGERS[kind]) return { data: MERGERS[kind](local.data, remote.data, lt, rt), lost: null };
  const winnerLocal = lt >= rt; return { data: winnerLocal ? local.data : remote.data, lost: winnerLocal ? remote.data : local.data };
}
