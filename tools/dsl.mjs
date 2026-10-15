// Compact authoring helpers: lessons written as .mjs emit the same JSON the validator checks.
import fs from 'node:fs';
const out = new URL('../content/lessons/', import.meta.url).pathname;
export const mcq = (concept, prompt, options, answer, why, hint) => ({ type: 'mcq', concept, prompt, options, answer, why, ...(hint ? { hint } : {}) });
export const fill = (concept, prompt, accept, why, hint) => ({ type: 'fill', concept, prompt, accept, why, ...(hint ? { hint } : {}) });
export const scn = (concept, prompt, options, why) => ({ type: 'scenario', concept, prompt, options: options.map(([text, score, feedback]) => ({ text, score, feedback })), why });
export const rp = (concept, setup, turns, why) => ({ type: 'roleplay', concept, setup, turns: turns.map(([they, opts]) => ({ they, options: opts.map(([text, score, feedback, reply]) => ({ text, score, feedback, reply })) })), why });
export const wr = (concept, prompt, minWords, rubric, modelAnswer, guidance) => ({ type: 'written', concept, prompt, minWords, rubric: rubric.map(([id, label, weight, d, auto]) => ({ id, label, weight, descriptors: { 0: d[0], 1: d[1], 2: d[2], 3: d[3] }, ...(auto ? { auto } : {}) })), modelAnswer, guidance });
export function lesson(id, d) {
  const [skillId, n] = [id.replace(/-\d+$/, ''), +id.split('-').pop()];
  const levels = [1, 1, 2, 3];
  const L = { id, skillId, n, title: d.title, summary: d.summary, difficulty: d.difficulty, minutes: { concept: 7, examples: 3, practice: 9, task: 6, quiz: 3 }, objectives: d.objectives,
    concepts: d.concepts.map(([cid, label]) => ({ id: `${skillId}.${cid}`, label })), explanation: d.explanation.map(([heading, body]) => ({ heading, body })), examples: d.examples.map(([title, body, takeaway]) => ({ title, body, takeaway })),
    exercises: d.exercises.map((e, i) => ({ id: `${id}.e${i + 1}`, level: levels[i], ...e, concept: `${skillId}.${e.concept}` })),
    task: { title: d.task[0], brief: d.task[1], steps: d.task[2], checklist: d.task[3], evidencePrompt: d.task[4], evidenceWords: d.task[5], minutes: 6 },
    quiz: d.quiz.map((e, i) => ({ id: `${id}.q${i + 1}`, ...e, concept: `${skillId}.${e.concept}` })), bank: d.bank.map((e, i) => ({ id: `${id}.b${i + 1}`, ...e, concept: `${skillId}.${e.concept}` })),
    cards: d.cards.map(([c, front, back], i) => ({ id: `${id}.c${i + 1}`, concept: `${skillId}.${c}`, front, back })), reflection: d.reflection, revision: { keyPoints: d.keyPoints, redo: d.redo } };
  fs.writeFileSync(out + id + '.json', JSON.stringify(L, null, 2));
}
