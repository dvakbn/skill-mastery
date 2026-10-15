// SAP ABAP track. Step 1: diagnostic quiz. The personalised 30-day plan is designed from its results.
// Stored as ordinary synced documents (kind "abap_diag"); the 26-skill engine never sees them.
import { h, mdEl, pctText, bar, toast, confirmDialog, fmtDate } from '../ui/lib.js';
import { uuid, dayKey } from '../engine/util.js';
import { scoreDiagnostic, summaryText, DONT_KNOW, STATUS_RULES } from '../engine/abap.js';

let BANK = null;
async function loadBank() { if (BANK) return BANK; const res = await fetch('data/abap-diagnostic.json'); if (!res.ok) throw new Error('HTTP ' + res.status); BANK = await res.json(); return BANK; }
const runs = repo => repo.docs.filter(d => d.kind === 'abap_diag' && !d.deleted);
const openRun = repo => runs(repo).filter(d => d.data.status === 'in_progress').sort((a, b) => a.data.startedAt < b.data.startedAt ? 1 : -1)[0];
const lastDone = repo => runs(repo).filter(d => d.data.status === 'submitted').sort((a, b) => a.data.submittedAt < b.data.submittedAt ? 1 : -1)[0];
const dayOf = iso => dayKey(new Date(iso));

export function abapView(ctx, arg) {
  const { repo } = ctx; const root = h('div', { class: 'view abap' }); const view = { el: root };
  const fail = e => { root.replaceChildren(h('h1', 'SAP ABAP'), h('p', { class: 'note warn' }, 'The ABAP diagnostic could not be loaded. Open the app once while online so it can be saved for offline use. (' + (e && e.message) + ')')); };
  loadBank().then(bank => { arg === 'diagnostic' ? diagnostic(bank) : hub(bank); }).catch(fail);

  function hub(bank) {
    const cur = openRun(repo), done = lastDone(repo), n = bank.questions.length;
    root.replaceChildren(h('h1', 'SAP ABAP'),
      h('p', { class: 'lead' }, 'A separate, mastery-based track to build strong ABAP fundamentals in 30 days or less. You already write programs, so it begins by measuring exactly where you stand.'),
      h('section', { class: 'card' }, h('p', { class: 'eyebrow' }, 'Step 1 · Diagnostic quiz'), h('h2', 'Find your weak areas'),
        h('ul', h('li', `${n} questions across ${bank.topics.length} areas (declarations, control flow, internal tables, Open SQL, Dictionary and tools, modularisation, selection screens and ALV, OOP and debugging).`), h('li', 'About 35 to 45 minutes. You can stop and resume; answers are saved as you go.'), h('li', 'No hints or feedback during the quiz, so the result is honest. Every answer is explained afterwards.'), h('li', '"I don\'t know" is a useful answer: it shows a gap, which is different from a wrong belief. Please do not guess.')),
        h('div', { class: 'row wrap' },
          cur ? h('a', { class: 'btn', href: '#/abap/diagnostic' }, `Resume (${Object.keys(cur.data.answers || {}).length}/${n} answered)`) : null,
          !cur ? h('a', { class: 'btn', href: '#/abap/diagnostic', onclick: async e => { e.preventDefault(); await start(); location.hash = '#/abap/diagnostic'; } }, done ? 'Take the diagnostic again' : 'Start the diagnostic') : null,
          done && !cur ? h('a', { class: 'btn ghost', href: '#/abap/diagnostic?view=result' }, `View last result (${dayOf(done.data.submittedAt)})`) : null),
        done ? h('p', { class: 'sm muted' }, `Last result: ${Math.round(done.data.result.overall.pct * 100)}% on ${fmtDate(dayOf(done.data.submittedAt))}.`) : null),
      h('section', { class: 'card' }, h('p', { class: 'eyebrow' }, 'Step 2 · Your 30-day plan'), h('h2', 'Built from your results'),
        h('p', done ? 'Your diagnostic is saved. The plan is designed from it next: missing concepts and weak areas first, then a cycle for every chapter (read, example, hands-on exercise in SAP Logon, quiz, review, retest if needed).' : 'Locked until you finish the diagnostic. The plan is designed from your answers, not from a fixed syllabus, so nothing is built yet.')));
  }
  async function start() { await repo.saveDoc('abap_diag', uuid(), { status: 'in_progress', startedAt: new Date().toISOString(), version: BANK.version, answers: {} }); }

  function diagnostic(bank) {
    const q = new URLSearchParams((location.hash.split('?')[1]) || ''); const cur = openRun(repo), done = lastDone(repo);
    if (cur) return quiz(bank, cur);
    if (done) return result(bank, done);
    start().then(() => diagnostic(bank));
  }

  function quiz(bank, doc) {
    const key = doc.key; const ans = () => (repo.getDoc('abap_diag', key) || doc).data.answers || {};
    const secs = bank.topics.map(t => ({ ...t, qs: bank.questions.filter(x => x.topic === t.id) })); let sec = 0;
    const tabs = h('nav', { class: 'steps' }), body = h('div');
    const save = (id, choice) => repo.updateDoc('abap_diag', key, d => { d.answers = d.answers || {}; d.answers[id] = { choice, ts: Date.now() }; return d; });
    const drawTabs = () => { const a = ans(); tabs.replaceChildren(...secs.map((s, i) => { const k = s.qs.filter(x => a[x.id]).length; return h('button', { class: 'step' + (i === sec ? ' cur' : '') + (k === s.qs.length ? ' done' : ''), onclick: () => { sec = i; drawTabs(); drawBody(); window.scrollTo({ top: 0 }); } }, h('span', { class: 'n' }, i + 1), h('span', s.label.split(' ')[0]), h('small', `${k}/${s.qs.length}`)); })); };
    const drawBody = () => {
      const s = secs[sec]; const a = ans(); body.replaceChildren(h('h2', s.label), h('p', { class: 'sm muted' }, s.blurb));
      s.qs.forEach(qn => {
        const idx = bank.questions.indexOf(qn) + 1; const chosen = a[qn.id] ? a[qn.id].choice : null; const btns = [];
        const pick = async (c, b) => { btns.forEach(x => { x.classList.toggle('sel', x === b); x.setAttribute('aria-checked', x === b); }); await save(qn.id, c); drawTabs(); };
        const opts = qn.options.map((o, i) => { const b = h('button', { class: 'opt' + (chosen === i ? ' sel' : ''), role: 'radio', 'aria-checked': String(chosen === i), onclick: () => pick(i, b) }, h('span', { class: 'k' }, 'ABCD'[i]), h('span', o)); btns.push(b); return b; });
        const dk = h('button', { class: 'opt dk' + (chosen === DONT_KNOW ? ' sel' : ''), role: 'radio', 'aria-checked': String(chosen === DONT_KNOW), onclick: () => pick(DONT_KNOW, dk) }, h('span', { class: 'k' }, '?'), h('span', "I don't know")); btns.push(dk);
        body.append(h('section', { class: 'card ex' }, h('p', { class: 'eyebrow' }, `Question ${idx} of ${bank.questions.length}`), mdEl(qn.prompt, 'prompt'), h('div', { class: 'opts', role: 'radiogroup' }, ...opts, dk)));
      });
      const nxt = sec < secs.length - 1; body.append(h('div', { class: 'row between' }, sec > 0 ? h('button', { class: 'btn ghost', onclick: () => { sec--; drawTabs(); drawBody(); window.scrollTo({ top: 0 }); } }, '← Previous area') : h('span'), nxt ? h('button', { class: 'btn', onclick: () => { sec++; drawTabs(); drawBody(); window.scrollTo({ top: 0 }); } }, 'Next area →') : null));
    };
    const submit = async () => {
      const a = ans(); const left = bank.questions.filter(x => !a[x.id]).length;
      if (left && !(await confirmDialog(`${left} question(s) are unanswered. They will count as gaps. Submit anyway?`, { ok: 'Submit', cancel: 'Keep going' }))) return;
      const res = scoreDiagnostic(bank, a);
      await repo.updateDoc('abap_diag', key, d => { d.status = 'submitted'; d.submittedAt = new Date().toISOString(); d.result = { overall: res.overall, byTopic: res.byTopic, byLevel: res.byLevel, ceiling: res.ceiling, missed: res.missed, answered: res.answered }; return d; });
      toast('Diagnostic submitted', 'ok'); location.hash = '#/abap/diagnostic'; route();
    };
    const route = () => { root.replaceChildren(); diagnostic(bank); };
    root.replaceChildren(h('a', { href: '#/abap', class: 'back' }, '← SAP ABAP'), h('h1', 'ABAP diagnostic'), h('p', { class: 'lead' }, 'No feedback until you finish. Choose "I don\'t know" instead of guessing. Answers save automatically, so you can leave and resume.'), tabs, body,
      h('section', { class: 'card' }, h('div', { class: 'row between' }, h('div', h('strong', 'Finished?'), h('p', { class: 'sm muted' }, 'You can change any answer until you submit.')), h('button', { class: 'btn', onclick: submit }, 'Submit diagnostic')),
        h('button', { class: 'btn ghost sm', onclick: async () => { if (await confirmDialog('Discard this attempt? Your answers on it will be lost.')) { await repo.updateDoc('abap_diag', key, d => { d.status = 'discarded'; return d; }); location.hash = '#/abap'; } } }, 'Discard attempt')));
    drawTabs(); drawBody();
  }

  function result(bank, doc) {
    const res = scoreDiagnostic(bank, doc.data.answers); const a = doc.data.answers || {}; let onlyMissed = true;
    const text = summaryText(bank, res, dayOf(doc.data.submittedAt)); const pct = x => Math.round(x * 100) + '%';
    const wrap = h('div'); const draw = () => {
      wrap.replaceChildren(...bank.questions.filter(x => !onlyMissed || (res.missed.some(m => m.id === x.id))).map(qn => {
        const r = a[qn.id]; const c = r ? r.choice : null; const ok = c === qn.answer;
        return h('section', { class: 'card ex' }, h('p', { class: 'eyebrow' }, `${bank.topics.find(t => t.id === qn.topic).label} · level ${qn.level} · ${ok ? 'correct' : c === DONT_KNOW ? "you said don't know" : c == null ? 'skipped' : 'wrong'}`), mdEl(qn.prompt, 'prompt'),
          h('div', { class: 'opts' }, ...qn.options.map((o, i) => h('div', { class: 'opt' + (i === qn.answer ? ' right' : i === c ? ' wrong' : '') }, h('span', { class: 'k' }, 'ABCD'[i]), h('span', o)))),
          h('p', { class: 'sm' }, h('strong', 'Why: '), qn.why));
      }));
      if (!wrap.childNodes.length) wrap.append(h('p', { class: 'muted' }, 'Nothing to review. Every question was answered correctly.'));
    };
    const ta = h('textarea', { class: 'txt', readonly: true, rows: 12, 'aria-label': 'Results summary', onfocus: e => e.target.select() }, text);
    root.replaceChildren(h('a', { href: '#/abap', class: 'back' }, '← SAP ABAP'), h('h1', 'ABAP diagnostic — results'),
      h('section', { class: 'card result' }, h('p', { class: 'eyebrow' }, 'Submitted ' + fmtDate(dayOf(doc.data.submittedAt))), h('p', { class: 'big' }, pct(res.overall.pct)),
        h('p', `${res.overall.correct} of ${res.overall.total} correct. ${res.overall.misconception} answered wrong, ${res.overall.gap} marked "I don't know", ${res.overall.skipped} skipped.`),
        h('p', res.ceiling === 3 ? 'You handled the hardest questions: level 3 reached.' : res.ceiling ? `Level ${res.ceiling} reached (60% or more at that level, not at the next).` : 'Level 1 basics need work first.'),
        h('div', { class: 'grid3' }, res.byLevel.map(l => h('div', h('p', { class: 'muted sm' }, ['', 'Level 1 · basics', 'Level 2 · working knowledge', 'Level 3 · advanced'][l.level]), h('p', { class: 'big sm' }, `${l.correct}/${l.total}`), bar(l.pct))))),
      h('section', { class: 'card' }, h('h2', 'By area (weakest first)'), h('p', { class: 'sm muted' }, STATUS_RULES),
        ...[...res.byTopic].sort((x, y) => x.pct - y.pct).map(t => h('div', { class: 'skrow' }, h('span', t.label), bar(t.pct, { color: t.status === 'weak' ? 'var(--bad)' : 'var(--accent)' }), h('span', `${t.correct}/${t.total}`), h('span', { class: 'tag' + (t.status === 'strong' ? ' ok' : '') }, t.status)))),
      h('section', { class: 'card' }, h('h2', 'Concepts to fix first'),
        res.missed.length ? h('div', ...[['misconception', 'Answered wrong (a mistaken belief: fix these first)'], ['gap', "Marked \"I don't know\" (not learned yet)"], ['skipped', 'Skipped']].map(([k, label]) => { const m = res.missed.filter(x => x.kind === k); return m.length ? h('p', h('strong', label + ': '), m.map(x => x.tag).join(', ')) : null; })) : h('p', 'None. Strong across the board.')),
      h('section', { class: 'card' }, h('h2', 'Your results summary'), h('p', { class: 'sm muted' }, 'The 30-day plan is designed from these results. Copy this and send it, or sign in so it syncs.'), ta,
        h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(text); toast('Copied', 'ok'); } catch { ta.focus(); ta.select(); toast('Select and copy the text'); } } }, 'Copy summary'),
          h('button', { class: 'btn ghost', onclick: async () => { if (await confirmDialog('Start a new diagnostic? This result stays saved.', { ok: 'Start new', cancel: 'Cancel' })) { await start(); route2(); } } }, 'Retake diagnostic'))),
      h('section', { class: 'card' }, h('div', { class: 'row between' }, h('h2', 'Review your answers'), h('button', { class: 'btn ghost sm', onclick: e => { onlyMissed = !onlyMissed; e.target.textContent = onlyMissed ? 'Show all' : 'Show missed only'; draw(); } }, 'Show all'))), wrap);
    draw();
    function route2() { root.replaceChildren(); diagnostic(bank); }
  }
  return view;
}
