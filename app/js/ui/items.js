// One widget renders and grades every item type. Used by lessons, reviews, drills and assessments.
import { h, mdEl, pctText } from './lib.js';
import { gradeMcq, gradeFill, gradeScenario, gradeRoleplay, gradeWritten, autoCheck } from '../engine/grading.js';
import { words } from '../engine/util.js';

const verdict = (res) => h('div', { class: 'verdict ' + (res.correct ? 'good' : res.pct >= 0.5 ? 'mid' : 'bad') }, res.correct ? '✓ Correct' : res.pct >= 0.5 ? '◐ Partly right' : '✗ Not quite', res.max > 1 ? ` · ${Math.round(res.pct * 100)}%` : '');
const why = (text) => text ? h('div', { class: 'why' }, h('strong', 'Answer guidance'), mdEl(text, 'prose sm')) : null;

export function renderItem(item, { support = false, readOnlyResult = null, onResult, hideFeedback = false } = {}) {
  const t0 = Date.now(); const root = h('div', { class: 'item item-' + item.type });
  const done = (res, response) => { onResult && onResult({ ...res, response, durationMs: Date.now() - t0 }); };
  const hint = item.hint ? h('details', { class: 'hint', open: support || null }, h('summary', 'Hint'), item.hint) : null;
  const prompt = mdEl(item.prompt || item.setup, 'prompt');
  if (item.type === 'mcq') {
    let chosen = null, locked = false; const fb = h('div'); const btns = [];
    const opts = h('div', { class: 'opts', role: 'radiogroup' }, item.options.map((o, i) => { const b = h('button', { class: 'opt', role: 'radio', 'aria-checked': 'false', onclick: () => { if (locked) return; chosen = i; btns.forEach((x, j) => { x.classList.toggle('sel', j === i); x.setAttribute('aria-checked', j === i); }); submit.disabled = false; } }, h('span', { class: 'k' }, 'ABCD'[i]), h('span', o)); btns.push(b); return b; }));
    const submit = h('button', { class: 'btn', disabled: true, onclick: () => { locked = true; submit.remove(); const res = gradeMcq(item, chosen); btns.forEach((b, j) => { b.disabled = true; if (j === item.answer) b.classList.add('right'); else if (j === chosen) b.classList.add('wrong'); }); if (!hideFeedback) fb.append(verdict(res), why(item.why)); done(res, chosen); } }, 'Check answer');
    root.append(prompt, opts, hint, submit, fb);
  } else if (item.type === 'fill') {
    const fb = h('div'); const inp = h('input', { class: 'txt', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer', placeholder: 'Type your answer' });
    const submit = h('button', { class: 'btn', onclick: () => { if (!inp.value.trim()) { inp.focus(); return; } inp.disabled = true; submit.remove(); const res = gradeFill(item, inp.value); if (!hideFeedback) { fb.append(verdict(res)); if (!res.correct) fb.append(h('p', { class: 'sm' }, 'Accepted: ', h('strong', item.accept.slice(0, 3).join('  /  ')))); fb.append(why(item.why)); } done(res, inp.value); } }, 'Check answer');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit.click(); });
    root.append(prompt, inp, hint, submit, fb);
  } else if (item.type === 'scenario') {
    let chosen = null, locked = false; const fb = h('div'); const btns = [];
    const opts = h('div', { class: 'opts' }, item.options.map((o, i) => { const b = h('button', { class: 'opt', onclick: () => { if (locked) return; chosen = i; btns.forEach((x, j) => x.classList.toggle('sel', j === i)); submit.disabled = false; } }, h('span', { class: 'k' }, 'ABCD'[i]), h('span', o.text)); btns.push(b); return b; }));
    const submit = h('button', { class: 'btn', disabled: true, onclick: () => { locked = true; submit.remove(); const res = gradeScenario(item, chosen); btns.forEach((b, j) => { b.disabled = true; const sc = item.options[j].score; if (sc === 3) b.classList.add('right'); else if (j === chosen) b.classList.add('wrong'); }); if (!hideFeedback) { fb.append(verdict(res), h('div', { class: 'why' }, h('strong', `Your choice (${res.score}/3)`), h('p', item.options[chosen].feedback)), h('details', { open: true }, h('summary', 'Feedback on every option'), h('ul', item.options.map((o, j) => h('li', h('strong', `${'ABCD'[j]} (${o.score}/3): `), o.feedback)))), why(item.why)); } done(res, chosen); } }, 'Submit decision');
    root.append(prompt, opts, hint, submit, fb);
  } else if (item.type === 'roleplay') {
    const choices = []; const log = h('div', { class: 'rp-log' }); root.append(h('div', { class: 'rp-setup' }, h('strong', 'Setup'), mdEl(item.setup, 'prose sm')), log);
    const turn = (i) => {
      const t = item.turns[i]; const wrap = h('div', { class: 'rp-turn' }); wrap.append(h('div', { class: 'bubble them' }, h('span', { class: 'who' }, 'Them'), t.they));
      const opts = h('div', { class: 'opts' }); t.options.forEach((o, j) => opts.append(h('button', { class: 'opt', onclick: () => {
        choices[i] = j; [...opts.children].forEach((b, k) => { b.disabled = true; b.classList.toggle('sel', k === j); });
        wrap.append(h('div', { class: 'bubble me' }, h('span', { class: 'who' }, 'You'), o.text));
        if (!hideFeedback) wrap.append(h('div', { class: 'rp-fb s' + o.score }, h('strong', `${o.score}/3 `), o.feedback));
        wrap.append(h('div', { class: 'bubble them' }, h('span', { class: 'who' }, 'Them'), o.reply));
        if (i + 1 < item.turns.length) turn(i + 1); else { const res = gradeRoleplay(item, choices); if (!hideFeedback) { const best = item.turns.map((tt, k) => `Turn ${k + 1}: best was “${tt.options.find(x => x.score === 3).text}”`); wrap.append(verdict(res), h('details', { class: 'why' }, h('summary', 'Best option at each turn'), h('ul', best.map(b => h('li', b)))), why(item.why)); } done(res, choices.slice()); }
      } }, h('span', { class: 'k' }, 'ABC'[j]), h('span', o.text))));
      wrap.append(opts); log.append(wrap); wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    turn(0);
  } else if (item.type === 'written') {
    const ta = h('textarea', { class: 'txt big', rows: 8, 'aria-label': 'Your written answer', placeholder: `Write at least ${item.minWords} words…` });
    const wc = h('span', { class: 'sm muted' }, `0 / ${item.minWords} words`); const phase2 = h('div'); const reveal = h('button', { class: 'btn', disabled: true, onclick: () => compare() }, 'Compare with model answer');
    ta.addEventListener('input', () => { const n = words(ta.value); wc.textContent = `${n} / ${item.minWords} words`; wc.classList.toggle('ok', n >= item.minWords); reveal.disabled = n < item.minWords; });
    const compare = () => {
      ta.disabled = true; reveal.remove(); const text = ta.value; const ratings = {}; const out = h('div'); const save = h('button', { class: 'btn', disabled: true }, 'Save my score'); const live = h('div', { class: 'live' });
      const refresh = () => { const r = gradeWritten(item, text, ratings); live.textContent = `Score so far: ${Math.round(r.pct * 100)}%` + (r.missingRatings ? ` · ${r.missingRatings} criterion(s) left to rate` : ''); save.disabled = r.missingRatings > 0; };
      out.append(h('div', { class: 'cols' }, h('div', h('h4', 'Model answer'), mdEl(item.modelAnswer, 'prose sm model')), h('div', h('h4', 'Answer guidance'), mdEl(item.guidance, 'prose sm'))));
      out.append(h('h4', 'Score yourself honestly against the rubric'), h('p', { class: 'sm muted' }, 'Rate each criterion 0-3 by comparing your answer with the model answer. Automatic checks can cap a rating at 1.'));
      for (const c of item.rubric) {
        const ac = autoCheck(c.auto, text); const row = h('fieldset', { class: 'crit' }, h('legend', `${c.label} (${c.weight}%)`));
        if (ac) row.append(h('div', { class: 'auto ' + (ac.met ? 'met' : 'unmet') }, ac.met ? '✓ Auto-check met: ' : '✗ Auto-check not met (rating capped at 1): ', ac.label));
        for (const k of [0, 1, 2, 3]) row.append(h('label', { class: 'rate' }, h('input', { type: 'radio', name: item.id + c.id, value: k, onchange: () => { ratings[c.id] = k; refresh(); } }), h('span', h('strong', k), ' ', c.descriptors[k])));
        out.append(row);
      }
      save.onclick = () => { save.disabled = true; const r = gradeWritten(item, text, ratings); live.append(' ✓ saved'); done(r, { text, ratings: { ...ratings } }); out.querySelectorAll('input').forEach(i => i.disabled = true); };
      out.append(live, save); refresh(); phase2.append(out); phase2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    root.append(prompt, ta, h('div', { class: 'row between' }, wc), hint, reveal, phase2);
  }
  return root;
}
export function renderCard(card, { onResult }) {
  const t0 = Date.now(); const root = h('div', { class: 'item item-card' }); const back = h('div', { class: 'cardback', hidden: true }, mdEl(card.back, 'prose'));
  const rate = h('div', { class: 'row rate-row', hidden: true }, [['Again', 1, 'bad'], ['Hard', 3, 'mid'], ['Good', 4, 'good'], ['Easy', 5, 'easy']].map(([l, q, c]) => h('button', { class: 'btn ' + c, onclick: () => { rate.querySelectorAll('button').forEach(b => b.disabled = true); onResult({ quality: q, pct: q >= 3 ? 1 : 0, score: q >= 3 ? 1 : 0, max: 1, correct: q >= 3, response: { quality: q }, durationMs: Date.now() - t0 }); } }, l)));
  const show = h('button', { class: 'btn', onclick: () => { show.remove(); back.hidden = false; rate.hidden = false; } }, 'Show answer');
  root.append(h('div', { class: 'cardfront' }, mdEl(card.front, 'prose')), show, back, rate); return root;
}
