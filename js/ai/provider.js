// AI-provider seam (intentionally unused in this version).
//
// The curriculum (data/*.json), database (attempts/docs), grading rules (engine/grading.js) and
// progress history never depend on a provider. A future provider plugs in here WITHOUT changing them:
//
//   registerProvider({ id, label, available(): boolean,
//     async reviewWritten({ item, text, rubric, rating }): { suggestedRatings?: {criterionId: 0-3}, comments?: string },
//     async generateItems({ concept, skillId, count }): Item[]            // must satisfy tools/validate-content.mjs shapes
//     async explainMistake({ item, response }): string })
//
// Rules for any provider: output is ADVISORY. Learner self-ratings stay authoritative; suggestions are stored
// under attempt.answer.extra.provider so history stays auditable; nothing here may run unless the learner
// enables it in Settings AND a provider is registered. No SDK, key or network call is bundled in this version.
const providers = new Map();
export const registerProvider = p => { providers.set(p.id, p); };
export const listProviders = () => [...providers.values()];
export function activeProvider(settings) { const p = providers.get(settings && settings.aiProvider); return p && p.available() ? p : null; }
export const NullProvider = { id: 'none', label: 'No AI (rule-based only)', available: () => false };
registerProvider(NullProvider);
