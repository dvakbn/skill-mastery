// Validates all curriculum content. Usage: node tools/validate-content.mjs [lessonId ...]
import fs from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const skills = JSON.parse(fs.readFileSync(root+'content/skills.json','utf8')).skills;
const curr = JSON.parse(fs.readFileSync(root+'content/curriculum.json','utf8'));
const BANNED = /\b(lorem|ipsum|todo|tbd|placeholder|coming soon|fill in later|to be added|insert here|xxx)\b|https?:\/\/|www\./i;
const errs = [];
const words = s => (String(s).trim().match(/\S+/g) || []).length;
function e(id, msg) { errs.push(`${id}: ${msg}`); }
function str(id, path, v, minW = 1) { if (typeof v !== 'string' || words(v) < minW) e(id, `${path} must be a string with >= ${minW} words`); else if (BANNED.test(v)) e(id, `${path} contains banned/placeholder/URL text`); }
const AUTO = ['keywords','forbidden','minSentences','regex'];
function checkItem(id, it, lesson, kinds, p) {
  if (!it || typeof it !== 'object') return e(id, p+' missing');
  const iid = `${id}/${it.id||p}`;
  if (typeof it.id !== 'string') e(iid, 'id missing');
  if (!kinds.includes(it.type)) return e(iid, `type must be one of ${kinds}`);
  if (!lesson.concepts.some(c => c.id === it.concept)) e(iid, `concept "${it.concept}" not in lesson.concepts`);
  str(iid, 'prompt', it.prompt || it.setup, 2);
  if (it.why !== undefined || it.type !== 'written') str(iid, 'why', it.why, 3);
  if (it.type === 'mcq') {
    if (!Array.isArray(it.options) || it.options.length < 3 || it.options.length > 4) e(iid, 'mcq needs 3-4 options');
    else { it.options.forEach((o,i)=>str(iid, 'option'+i, o, 1)); if (new Set(it.options).size !== it.options.length) e(iid, 'duplicate options'); }
    if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= (it.options||[]).length) e(iid, 'answer index invalid');
  } else if (it.type === 'fill') {
    if (!Array.isArray(it.accept) || !it.accept.length || it.accept.some(a => typeof a !== 'string' || !a.trim())) e(iid, 'fill needs non-empty accept[]');
  } else if (it.type === 'scenario') {
    if (!Array.isArray(it.options) || it.options.length < 3 || it.options.length > 4) e(iid, 'scenario needs 3-4 options');
    else {
      it.options.forEach((o,i)=>{ str(iid,'option'+i+'.text',o.text,3); str(iid,'option'+i+'.feedback',o.feedback,4); if(![0,1,2,3].includes(o.score)) e(iid,'option score must be 0-3'); });
      if (!it.options.some(o=>o.score===3)) e(iid,'needs an option scoring 3');
      if (!it.options.some(o=>o.score<=1)) e(iid,'needs an option scoring 0 or 1');
    }
  } else if (it.type === 'roleplay') {
    str(iid,'setup',it.setup,10);
    if (!Array.isArray(it.turns) || it.turns.length < 3 || it.turns.length > 4) e(iid,'roleplay needs 3-4 turns');
    else it.turns.forEach((t,ti)=>{
      str(iid,`turn${ti}.they`,t.they,4);
      if (!Array.isArray(t.options) || t.options.length !== 3) return e(iid,`turn${ti} needs exactly 3 options`);
      t.options.forEach((o,oi)=>{ str(iid,`turn${ti}.o${oi}.text`,o.text,2); str(iid,`turn${ti}.o${oi}.feedback`,o.feedback,4); str(iid,`turn${ti}.o${oi}.reply`,o.reply,1); if(![0,1,2,3].includes(o.score)) e(iid,'score must be 0-3'); });
      if (!t.options.some(o=>o.score===3)) e(iid,`turn${ti} needs a 3-score option`);
      if (!t.options.some(o=>o.score<=1)) e(iid,`turn${ti} needs a weak option`);
    });
  } else if (it.type === 'written') {
    if (!Number.isInteger(it.minWords) || it.minWords < 10) e(iid,'minWords >= 10 required');
    if (!Array.isArray(it.rubric) || it.rubric.length < 3 || it.rubric.length > 5) e(iid,'rubric needs 3-5 criteria');
    else {
      let sum = 0;
      it.rubric.forEach(r=>{ sum += r.weight||0; str(iid,`rubric.${r.id}.label`,r.label,1);
        for (const k of ['0','1','2','3']) str(iid,`rubric.${r.id}.descriptor${k}`,(r.descriptors||{})[k],1);
        if (r.auto) { if(!AUTO.includes(r.auto.type)) e(iid,'bad auto type'); str(iid,'auto.label',r.auto.label,2);
          if (r.auto.type==='keywords' && (!Array.isArray(r.auto.any)||!r.auto.any.length)) e(iid,'keywords.any required');
          if (r.auto.type==='forbidden' && (!Array.isArray(r.auto.patterns)||!r.auto.patterns.length)) e(iid,'forbidden.patterns required');
          if (r.auto.type==='minSentences' && !Number.isInteger(r.auto.min)) e(iid,'minSentences.min required');
          if (r.auto.type==='regex') { try { new RegExp(r.auto.pattern, r.auto.flags||'i'); } catch { e(iid,'bad regex'); } } }
      });
      if (sum !== 100) e(iid, `rubric weights must sum to 100 (got ${sum})`);
      if (new Set(it.rubric.map(r=>r.id)).size !== it.rubric.length) e(iid,'duplicate rubric ids');
    }
    str(iid,'modelAnswer',it.modelAnswer,Math.max(15,Math.floor(it.minWords*0.6)));
    str(iid,'guidance',it.guidance,15);
  }
}
function validateLesson(file) {
  const lesson = JSON.parse(fs.readFileSync(file,'utf8'));
  const id = lesson.id || file;
  const m = /^([a-z]+)-(\d+)$/.exec(lesson.id||''); if (!m) return e(id,'bad id');
  const skill = skills.find(s=>s.id===m[1]); if (!skill) return e(id,'unknown skill');
  const meta = skill.lessons.find(l=>l.n===+m[2]); if (!meta) return e(id,'unknown lesson number');
  if (lesson.skillId!==m[1] || lesson.n!==+m[2]) e(id,'skillId/n mismatch');
  if (lesson.title !== meta.title) e(id,`title must equal "${meta.title}"`);
  str(id,'summary',lesson.summary,6);
  if (![1,2,3].includes(lesson.difficulty)) e(id,'difficulty 1-3');
  const mm = lesson.minutes||{}; const total = ['concept','examples','practice','task','quiz'].reduce((a,k)=>a+(mm[k]||0),0);
  if (total !== 28) e(id,`minutes must total 28 (got ${total}); use concept 7, examples 3, practice 9, task 6, quiz 3`);
  if (!Array.isArray(lesson.objectives)||lesson.objectives.length!==3) e(id,'exactly 3 objectives'); else lesson.objectives.forEach((o,i)=>str(id,'objective'+i,o,5));
  if (!Array.isArray(lesson.concepts)||lesson.concepts.length<3||lesson.concepts.length>4) { e(id,'3-4 concepts'); lesson.concepts = lesson.concepts||[]; }
  lesson.concepts.forEach(c=>{ if(!new RegExp('^'+m[1]+'\\.[a-z0-9-]+$').test(c.id||'')) e(id,`concept id "${c.id}" must look like ${m[1]}.kebab-name`); str(id,'concept.label',c.label,1); });
  if (!Array.isArray(lesson.explanation)||lesson.explanation.length<3||lesson.explanation.length>5) e(id,'3-5 explanation sections');
  else { let w=0; lesson.explanation.forEach((s,i)=>{ str(id,`explanation${i}.heading`,s.heading,2); str(id,`explanation${i}.body`,s.body,30); w+=words(s.body); }); if (w<380) e(id,`explanation too short (${w} words, need >= 380)`); if (w>1100) e(id,`explanation too long (${w} words, max 1100)`); }
  if (!Array.isArray(lesson.examples)||lesson.examples.length<2||lesson.examples.length>3) e(id,'2-3 examples'); else lesson.examples.forEach((x,i)=>{ str(id,`example${i}.title`,x.title,2); str(id,`example${i}.body`,x.body,15); str(id,`example${i}.takeaway`,x.takeaway,4); });
  if (!Array.isArray(lesson.exercises)||lesson.exercises.length!==4) e(id,'exactly 4 exercises'); else {
    lesson.exercises.forEach((x,i)=>{ if (x.id!==`${id}.e${i+1}`) e(id,`exercise ${i} id must be ${id}.e${i+1}`); if(![1,2,3].includes(x.level)) e(id,`exercise ${i} level 1-3`); checkItem(id,x,lesson,['mcq','fill','scenario','roleplay','written'],'exercise'+i); });
    if (lesson.exercises.map(x=>x.level).join('')!=='1123') e(id,'exercise levels must be 1,1,2,3 in order');
    if (!lesson.exercises.some(x=>x.type==='written')) e(id,'at least one written exercise');
    if (!lesson.exercises.some(x=>x.level===3)) e(id,'needs a level 3 stretch exercise');
  }
  const t = lesson.task||{}; str(id,'task.title',t.title,2); str(id,'task.brief',t.brief,6);
  if (!Array.isArray(t.steps)||t.steps.length<3||t.steps.length>6) e(id,'task 3-6 steps'); else t.steps.forEach((s,i)=>str(id,'task.step'+i,s,3));
  if (!Array.isArray(t.checklist)||t.checklist.length<3||t.checklist.length>6) e(id,'task 3-6 checklist'); else t.checklist.forEach((s,i)=>str(id,'task.check'+i,s,3));
  str(id,'task.evidencePrompt',t.evidencePrompt,5); if(!Number.isInteger(t.evidenceWords)||t.evidenceWords<8||t.evidenceWords>60) e(id,'task.evidenceWords 8-60'); if (t.minutes!==6) e(id,'task.minutes must be 6');
  if (!Array.isArray(lesson.quiz)||lesson.quiz.length!==4) e(id,'exactly 4 quiz items'); else lesson.quiz.forEach((x,i)=>{ if(x.id!==`${id}.q${i+1}`) e(id,`quiz ${i} id must be ${id}.q${i+1}`); checkItem(id,x,lesson,['mcq','fill'],'quiz'+i); });
  if (!Array.isArray(lesson.bank)||lesson.bank.length!==3) e(id,'exactly 3 bank items'); else lesson.bank.forEach((x,i)=>{ if(x.id!==`${id}.b${i+1}`) e(id,`bank ${i} id must be ${id}.b${i+1}`); checkItem(id,x,lesson,['mcq','fill'],'bank'+i); });
  if (!Array.isArray(lesson.cards)||lesson.cards.length!==4) e(id,'exactly 4 cards'); else lesson.cards.forEach((c,i)=>{ if(c.id!==`${id}.c${i+1}`) e(id,`card ${i} id must be ${id}.c${i+1}`); if(!lesson.concepts.some(k=>k.id===c.concept)) e(id,`card ${i} concept invalid`); str(id,'card.front',c.front,2); str(id,'card.back',c.back,5); });
  // every concept must be tested at least once in quiz+bank
  const tested = new Set([...(lesson.quiz||[]),...(lesson.bank||[])].map(x=>x.concept));
  lesson.concepts.forEach(c=>{ if(!tested.has(c.id)) e(id,`concept ${c.id} not covered by quiz/bank`); });
  const mc = [...(lesson.quiz||[]),...(lesson.bank||[]),...(lesson.exercises||[])].filter(x=>x.type==='mcq').map(x=>x.answer);
  if (mc.length>=4 && new Set(mc).size<3) e(id,'vary the position of correct mcq answers (use at least 3 different indexes)');
  str(id,'reflection',lesson.reflection,8);
  const rv = lesson.revision||{}; if(!Array.isArray(rv.keyPoints)||rv.keyPoints.length<3||rv.keyPoints.length>6) e(id,'revision.keyPoints 3-6'); else rv.keyPoints.forEach((k,i)=>str(id,'revision.key'+i,k,3)); str(id,'revision.redo',rv.redo,8);
  const dayInfo = curr.lessonDay[id]; if (!dayInfo) e(id,'not in curriculum');
  return lesson;
}
const args = process.argv.slice(2);
const files = args.length ? args.map(a=>root+'content/lessons/'+a.replace(/\.json$/,'')+'.json') : fs.readdirSync(root+'content/lessons').filter(f=>f.endsWith('.json')).map(f=>root+'content/lessons/'+f);
let ok = 0;
for (const f of files) { if (!fs.existsSync(f)) { e(f,'file missing'); continue; } const before=errs.length; try { validateLesson(f); } catch (x) { e(f,'JSON parse/validation crash: '+x.message); } if (errs.length===before) ok++; }
if (!args.length) {
  for (const id of Object.keys(curr.lessonDay)) if (!fs.existsSync(root+`content/lessons/${id}.json`)) e(id,'lesson file missing');
  // assessments
  for (const d of curr.days.filter(d=>d.assessment)) {
    const f = root+`content/assessments/${d.assessment}.json`;
    if (!fs.existsSync(f)) { e(d.assessment,'assessment file missing'); continue; }
    try { const a = JSON.parse(fs.readFileSync(f,'utf8')); const aid=a.id;
      if (a.id!==d.assessment||a.day!==d.day) e(aid,'id/day mismatch'); str(aid,'title',a.title,2); str(aid,'intro',a.intro,10);
      const fake = {concepts:(a.concepts||[])}; if(!fake.concepts.length) e(aid,'concepts[] required');
      if (!Array.isArray(a.items)||a.items.length<3) e(aid,'needs >=3 items'); else a.items.forEach((x,i)=>{ if(x.id!==`${aid}.a${i+1}`) e(aid,`item ${i} id must be ${aid}.a${i+1}`); if(!Array.isArray(x.skills)||!x.skills.length) e(aid,`item ${i} skills[] required`); checkItem(aid,x,fake,['scenario','roleplay','written'],'item'+i); });
      if (a.items && !a.items.some(x=>x.type==='written')) e(aid,'needs a written item');
    } catch (x) { e(d.assessment,'crash: '+x.message); }
  }
}
if (errs.length) { console.log(errs.join('\n')); console.log(`\n${errs.length} problem(s); ${ok}/${files.length} lesson files clean`); process.exit(1); }
console.log(`OK: ${ok}/${files.length} lesson files valid${args.length?'':' + assessments'}`);
