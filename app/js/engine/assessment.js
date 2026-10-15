// Weekly/final assessment: deterministic item selection (resumable) and transparent scoring.
import { indexContent } from './derive.js';
import { rng } from './util.js';
import { PASS } from './grading.js';

export function coverageOf(content, def) { return def.id === 'final' ? content.skills.map(s => s.id) : def.coverage; }
export function selectAutoItems(content, st, def, seed) {
  const idx = indexContent(content); const cov = new Set(coverageOf(content, def)); const r = rng(seed);
  const weak = new Set(st.mistakes.filter(m => m.status !== 'resolved').map(m => m.concept));
  const seenInAssess = new Set(st.attempts.filter(a => a.kind === 'assessment' && a.item_id).map(a => a.item_id));
  const cands = [];
  for (const [id, info] of idx.items) {
    if (!(info.pool === 'quiz' || info.pool === 'bank')) continue; if (!st.lessons[info.lessonId].completedAt) continue;
    const s = st.srs.get(id);
    cands.push({ id, skillId: info.skillId, inCov: cov.has(info.skillId), prio: (weak.has(info.item.concept) ? 2 : 0) + (seenInAssess.has(id) ? 0 : 1) + (s ? Math.min(2, s.lapses || 0) * 0.5 : 0) + (info.pool === 'bank' ? 0.7 : 0) + r() });
  }
  const target = def.id === 'final' ? 24 : 12, extra = def.id === 'final' ? 0 : 3;
  const pick = [], used = new Set();
  const take = (list, n) => { for (const c of list.sort((a, b) => b.prio - a.prio)) { if (n <= 0) break; if (used.has(c.id)) continue; pick.push(c.id); used.add(c.id); n--; } };
  const covC = cands.filter(c => c.inCov);
  const skills = [...new Set(covC.map(c => c.skillId))];
  for (const s of skills) take(covC.filter(c => c.skillId === s), 1); // at least one per covered skill
  take(covC.filter(c => !used.has(c.id)), target - pick.length);
  take(cands.filter(c => !c.inCov && !used.has(c.id)), extra); // interleave earlier material
  if (pick.length < Math.min(target, covC.length)) take(covC.filter(c => !used.has(c.id)), target - pick.length);
  return pick;
}
// auto: [{itemId, skillId, pct}], applied: [{id, type, skills, pct, complete}], weights fixed.
export function scoreAssessment({ def, autoExpected, auto, applied, passMark = 70 }) {
  const autoPct = autoExpected ? auto.reduce((a, x) => a + x.pct, 0) / autoExpected : 0;
  const dec = applied.filter(x => x.type !== 'written'), wr = applied.filter(x => x.type === 'written');
  const decPct = dec.length ? dec.reduce((a, x) => a + (x.answered ? x.pct : 0), 0) / dec.length : 0;
  const wrPct = wr.length ? wr.reduce((a, x) => a + (x.answered ? x.pct : 0), 0) / wr.length : 0;
  const hasDec = dec.length > 0, hasWr = wr.length > 0;
  const W = { auto: autoExpected ? 50 : 0, dec: hasDec ? 20 : 0, wr: hasWr ? 30 : 0 }; const tot = W.auto + W.dec + W.wr;
  const pct = (autoPct * W.auto + decPct * W.dec + wrPct * W.wr) / tot;
  const complete = auto.length >= autoExpected && applied.every(x => x.answered && x.complete !== false);
  const bySkill = {};
  for (const a of auto) (bySkill[a.skillId] ||= []).push(a.pct);
  for (const x of applied) for (const s of x.skills || []) (bySkill[s] ||= []).push(x.answered ? x.pct : 0);
  const skillScores = Object.entries(bySkill).map(([skillId, v]) => ({ skillId, pct: v.reduce((a, b) => a + b, 0) / v.length, n: v.length })).sort((a, b) => a.pct - b.pct);
  return { pct, parts: { auto: autoPct, decision: decPct, written: wrPct }, weights: W, complete, passed: complete && pct * 100 >= passMark, skillScores, weak: skillScores.filter(s => s.pct < PASS).map(s => s.skillId) };
}
