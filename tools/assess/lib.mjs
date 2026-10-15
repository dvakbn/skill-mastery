import fs from 'node:fs';
export { scn, rp, wr } from '../dsl.mjs';
const out = new URL('../../content/assessments/', import.meta.url).pathname;
const LABELS = (await import('node:fs')).default.existsSync(new URL('../../content/skills.json', import.meta.url).pathname)
  ? JSON.parse(fs.readFileSync(new URL('../../content/skills.json', import.meta.url).pathname, 'utf8')) : {};
const skillList = LABELS.skills || LABELS;
export function assessment(def, items) {
  const concepts = new Map();
  const built = items.map((it, i) => {
    const sk = it.skills[0]; const concept = `${sk}.applied`;
    const name = (skillList.find(s => s.id === sk) || {}).name || sk;
    concepts.set(concept, { id: concept, label: `${name}: applied` });
    const item = { ...it.item }; if (item.type === 'written') item.minWords = Math.min(item.minWords, Math.floor(item.modelAnswer.split(/\s+/).length * 0.8)); // the model answer must itself meet the minimum
    return { id: `${def.id}.a${i + 1}`, skills: it.skills, ...item, concept };
  });
  const a = { id: def.id, week: def.week, day: def.day, title: def.title, intro: def.intro, coverage: def.coverage, concepts: [...concepts.values()], passMark: 70, items: built };
  fs.writeFileSync(out + def.id + '.json', JSON.stringify(a, null, 1));
}
