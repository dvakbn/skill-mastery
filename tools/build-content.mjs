// Bundles content/*.json into app/data/*.json (what the offline app loads and the service worker caches).
import fs from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const skillsFile = JSON.parse(fs.readFileSync(root + 'content/skills.json', 'utf8'));
const curriculum = JSON.parse(fs.readFileSync(root + 'content/curriculum.json', 'utf8'));
const lessons = {}; for (const f of fs.readdirSync(root + 'content/lessons').filter(f => f.endsWith('.json')).sort()) { const l = JSON.parse(fs.readFileSync(root + 'content/lessons/' + f, 'utf8')); lessons[l.id] = l; }
const assessments = {}; if (fs.existsSync(root + 'content/assessments')) for (const f of fs.readdirSync(root + 'content/assessments').filter(f => f.endsWith('.json')).sort()) { const a = JSON.parse(fs.readFileSync(root + 'content/assessments/' + f, 'utf8')); assessments[a.id] = a; }
const bundle = { version: 1, builtAt: new Date().toISOString(), groups: skillsFile.groups, skills: skillsFile.skills, curriculum, lessons, assessments };
fs.mkdirSync(root + 'app/data', { recursive: true });
fs.writeFileSync(root + 'app/data/content.json', JSON.stringify(bundle));
console.log(`content.json: ${Object.keys(lessons).length} lessons, ${Object.keys(assessments).length} assessments, ${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB`);
