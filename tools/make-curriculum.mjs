// Generates content/curriculum.json: the fixed 60-day plan.
import fs from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const skills = JSON.parse(fs.readFileSync(root + 'content/skills.json', 'utf8')).skills;
const L = {
 1:[['goals-1','english-1'],['time-1','reading-1'],['discipline-1','english-2'],['stress-1','reading-2'],['goals-2','time-2'],['discipline-2','english-3']],
 2:[['critical-1','writing-1'],['eq-1','stress-2'],['english-4','reading-3'],['critical-2','writing-2'],['time-3','discipline-3'],['confidence-1','goals-3']],
 3:[['problem-1','critical-3'],['research-1','ai-1'],['tech-1','problem-2'],['writing-3','reading-4'],['eq-2','confidence-2'],['research-2','ai-2']],
 4:[['etiquette-1','grooming-1'],['eq-3','conflict-1'],['tech-2','problem-3'],['stress-3','discipline-4'],['networking-1','confidence-3'],['critical-4','research-3']],
 5:[['career-1','goals-4'],['finance-1','time-4'],['presentation-1','confidence-4'],['conflict-2','negotiation-1'],['grooming-2','etiquette-2'],['ai-3','tech-3']],
 6:[['leadership-1','eq-4'],['creativity-1','problem-4'],['gk-1','writing-4'],['adapt-1','stress-4'],['finance-2','career-2'],['networking-2','presentation-2']],
 7:[['negotiation-2','conflict-3'],['leadership-2','adapt-2'],['creativity-2','research-4'],['gk-2','ai-4'],['finance-3','tech-4'],['etiquette-3','networking-3']],
 8:[['negotiation-3','leadership-3'],['conflict-4','etiquette-4'],['career-3','presentation-3'],['creativity-3','gk-3'],['finance-4','adapt-3'],['networking-4','grooming-3']],
 9:[['negotiation-4','leadership-4'],['career-4','adapt-4'],['creativity-4','gk-4']]
};
const themes = {1:'Foundations: habits, time and basic English',2:'Thinking and communicating clearly',3:'Problem-solving, research and digital skills',4:'Working with people: presence, emotion and etiquette',5:'Influence and careers: negotiation, money and presenting',6:'Leadership, creativity and knowledge',7:'Deepening: negotiation, teams and finance',8:'Integration: careers, conflict, presenting and networking',9:'Completion and capstone'};
const lessonDay = {}; const days = [];
let day = 1;
for (let w = 1; w <= 9; w++) {
  for (const pair of L[w]) { days.push({day, week:w, type:'lesson', lessons:pair}); pair.forEach(id => lessonDay[id] = day); day++; }
  if (w <= 8) { days.push({day, week:w, type:'assessment', assessment:'week-'+w, lessons:[]}); day++; }
}
days.push({day:60, week:9, type:'final', assessment:'final', lessons:[]});
if (days.length !== 60 || days.some((d,i)=>d.day!==i+1)) throw new Error('bad day count '+days.length);
// verify coverage
const want = new Set(); for (const s of skills) for (const l of s.lessons) want.add(s.id+'-'+l.n);
const got = Object.keys(lessonDay);
for (const id of want) if (!lessonDay[id]) throw new Error('missing '+id);
for (const id of got) if (!want.has(id)) throw new Error('unknown '+id);
// order check: lesson n of a skill must come before n+1
for (const s of skills) for (let n=1;n<s.lessons.length;n++) if (lessonDay[s.id+'-'+n] >= lessonDay[s.id+'-'+(n+1)]) throw new Error('order '+s.id);
const weeks = Object.keys(themes).map(w => ({week:+w, theme:themes[w], days:days.filter(d=>d.week==w).map(d=>d.day),
  skills:[...new Set(days.filter(d=>d.week==w).flatMap(d=>d.lessons.map(x=>x.replace(/-\d+$/,''))))]}));
const out = {totalDays:60, lessonCount:got.length,
  dailyTemplate:{review:8, lessonEach:28, reflection:6, lessonBreakdown:{concept:7,examples:3,practice:9,task:6,quiz:3}},
  weeks, days, lessonDay};
fs.writeFileSync(root+'content/curriculum.json', JSON.stringify(out,null,1));
console.log('lessons', got.length, 'days', days.length);
