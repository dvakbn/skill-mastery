// Transparent grading rules. Every function is pure and documented in RULES_TEXT (shown in the UI).
import { normalize, words, clamp } from './util.js';

export const PASS = 0.7; // pct at/above which an attempt counts as "demonstrated"
export const RULES_TEXT = {
  mcq: 'Multiple choice: 1 point if correct, otherwise 0.',
  fill: 'Short answer: your text is lower-cased, trimmed and compared with every accepted answer. Numbers are compared by value (₹, commas and spaces ignored).',
  scenario: 'Decision scenario: each option has a fixed score from 0 to 3 (3 = best). Score = option score / 3. Counted as correct only if you chose the best option.',
  roleplay: 'Role-play: each turn is scored 0-3 like a scenario. Score = total / (3 × turns). Counted as correct at 70% or above.',
  written: 'Written task: you rate yourself 0-3 on each rubric criterion by comparing your answer with the model answer. Where a criterion has an automatic check and it is not met, your rating for that criterion is capped at 1. Score = Σ(weight × rating/3). Minimum word count must be met or the attempt is incomplete.',
  assessment: 'Weekly assessment: auto-graded quiz 50%, decision/role-play 20%, written task 30%. Pass mark 70%. Incomplete assessments are saved but never count as mastery evidence.'
};

export function gradeMcq(item, choice) {
  const correct = choice === item.answer;
  return { score: correct ? 1 : 0, max: 1, correct, pct: correct ? 1 : 0 };
}
const num = s => { const t = String(s).replace(/[₹,\s]|rs\.?|inr/gi, '').replace(/%$/, ''); return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null; };
export function gradeFill(item, text) {
  const n = normalize(text); const nn = num(n);
  const hit = n !== '' && item.accept.some(a => { const na = normalize(a); if (na === n) return true; const an = num(na); return nn !== null && an !== null && Math.abs(an - nn) < 1e-9; });
  return { score: hit ? 1 : 0, max: 1, correct: hit, pct: hit ? 1 : 0 };
}
export function gradeScenario(item, choice) {
  const o = item.options[choice]; const s = o ? o.score : 0;
  return { score: s, max: 3, correct: s === 3, pct: s / 3, feedback: o && o.feedback };
}
export function gradeRoleplay(item, choices) {
  let total = 0; item.turns.forEach((t, i) => { const o = t.options[choices[i]]; total += o ? o.score : 0; });
  const max = 3 * item.turns.length; const pct = total / max;
  return { score: total, max, correct: pct >= PASS, pct };
}
export function autoCheck(auto, text) {
  if (!auto) return null;
  const t = String(text || ''); const low = t.toLowerCase(); let met = false;
  if (auto.type === 'keywords') { const hits = auto.any.filter(k => low.includes(String(k).toLowerCase())).length; met = hits >= (auto.min || 1); }
  else if (auto.type === 'forbidden') met = !auto.patterns.some(p => low.includes(String(p).toLowerCase()));
  else if (auto.type === 'minSentences') met = (t.match(/[^.!?]+[.!?]+/g) || []).length >= auto.min;
  else if (auto.type === 'regex') { try { met = new RegExp(auto.pattern, auto.flags || 'i').test(t); } catch { met = false; } }
  return { met, label: auto.label };
}
// ratings: {criterionId: 0..3 or undefined}
export function gradeWritten(item, text, ratings = {}) {
  const wc = words(text); const belowMin = wc < item.minWords;
  let sumW = 0, got = 0, missing = 0; const criteria = [];
  for (const r of item.rubric) {
    const ac = autoCheck(r.auto, text); const raw = ratings[r.id];
    if (raw === undefined || raw === null) missing++;
    let eff = raw === undefined || raw === null ? 0 : clamp(raw, 0, 3); let capped = false;
    if (ac && !ac.met && eff > 1) { eff = 1; capped = true; }
    criteria.push({ id: r.id, label: r.label, weight: r.weight, rating: raw ?? null, effective: eff, capped, auto: ac });
    sumW += r.weight; got += r.weight * eff / 3;
  }
  const pct = sumW ? got / sumW : 0;
  return { score: Math.round(pct * 100) / 100, max: 1, pct, correct: pct >= PASS, wordCount: wc, belowMin, missingRatings: missing, complete: !belowMin && missing === 0, criteria };
}
export function gradeItem(item, response) {
  switch (item.type) {
    case 'mcq': return gradeMcq(item, response);
    case 'fill': return gradeFill(item, response);
    case 'scenario': return gradeScenario(item, response);
    case 'roleplay': return gradeRoleplay(item, response);
    case 'written': return gradeWritten(item, response.text, response.ratings);
  }
  throw new Error('unknown item type ' + item.type);
}
// quality 0-5 for spaced repetition from a graded result
export function qualityOf(res, kind) {
  if (kind === 'card') return res.quality;
  const p = res.pct;
  return p >= 0.9 ? 5 : p >= 0.7 ? 4 : p >= 0.5 ? 3 : p >= 0.25 ? 2 : 1;
}
