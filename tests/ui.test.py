"""End-to-end UI test (Playwright + Chromium). Usage: node tools/serve.mjs 8765 &  python3 tests/ui.test.py"""
import json, sys, time
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
errors, ok = [], 0
def check(cond, msg):
    global ok
    if not cond: print('  ✗', msg); sys.exit(1)
    ok += 1; print('  ✓', msg)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 420, 'height': 900}); page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None); page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '#/today'); page.wait_for_selector('h1'); 
    check('Day 1 of 60' in page.inner_text('h1'), 'Today shows Day 1 of 60')
    content = page.evaluate('window.__app.content'); L = content['lessons']['english-1']
    page.goto(BASE + '#/lesson/english-1'); page.wait_for_selector('.lhead')
    page.click('text=I have read this, continue'); page.click('text=Continue to practice')
    # exercise 1: mcq
    e1, e2, e3 = L['exercises'][:3]
    cards = page.locator('.card.ex')
    cards.nth(0).locator('.opt').nth(e1['answer']).click(); cards.nth(0).locator('text=Check answer').click(); page.wait_for_selector('.verdict.good')
    check(True, 'exercise 1 (mcq) graded correct')
    cards.nth(1).locator('input.txt').fill(e2['accept'][0]); cards.nth(1).locator('text=Check answer').click()
    check(cards.nth(1).locator('.verdict.good').count() == 1, 'exercise 2 (fill) graded correct')
    # exercise 3: written with rubric self-scoring
    cards.nth(2).locator('textarea').fill(e3['modelAnswer']); cards.nth(2).locator('text=Compare with model answer').click()
    for c in e3['rubric']: cards.nth(2).locator(f'input[name="{e3["id"]}{c["id"]}"][value="3"]').check()
    cards.nth(2).locator('text=Save my score').click()
    page.wait_for_function('window.__app.repo.attempts.filter(a=>a.item_id=="english-1.e3").length==1')
    a3 = page.evaluate('window.__app.repo.attempts.find(a=>a.item_id=="english-1.e3")'); check(a3['score'] > 0.9, f'written scored {a3["score"]}')
    page.click('text=Continue to the task'); T = L['task']
    for i in range(len(T['checklist'])): page.locator('.chk input').nth(i).check()
    page.fill('textarea.txt', ' '.join(['evidence']*T['evidenceWords'])); page.click('text=Mark task complete'); page.wait_for_selector('text=Completed ✓')
    check(True, 'task completed with evidence')
    page.click('text=Continue to the quiz')
    for q in L['quiz']:
        page.wait_for_selector('.item'); 
        if q['type'] == 'mcq': page.locator('.opt').nth(q['answer']).click()
        else: page.fill('input.txt', q['accept'][0])
        page.click('text=Check answer'); page.wait_for_selector('.verdict')
        page.wait_for_selector('button:has-text("Next question"), button:has-text("Finish quiz")'); page.click('button:has-text("Next question"), button:has-text("Finish quiz")')
    page.click('text=See lesson summary'); page.click('text=Mark lesson complete'); page.wait_for_selector('text=Lesson complete ✓')
    st = page.evaluate('(()=>{const s=window.__app.repo.state();return {done:!!s.lessons["english-1"].completedAt,level:s.mastery.english.level,score:s.mastery.english.score,att:s.attempts.length}})()')
    check(st['done'] and st['level'] == 2, f'lesson complete + same-day evidence = Practising only, not Proficient (completion != mastery): {st}')
    # review is not due same day
    page.goto(BASE + '#/review'); page.wait_for_selector('h1'); check('Nothing to do' in page.inner_text('.view'), 'no review due on completion day')
    # simulate next day: backdate by time travel (re-derive with tomorrow)
    due = page.evaluate("""(()=>{const r=window.__app.repo;const d=new Date();d.setDate(d.getDate()+1);const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return r.state(k).dueItems.length})()""")
    check(due == len(L['quiz'])+len(L['bank'])+len(L['cards']), f'{due} items due the next day')
    # persistence + offline
    page.goto(BASE + '#/today'); page.wait_for_selector('h1'); page.evaluate('navigator.serviceWorker.ready'); time.sleep(1.5); page.reload(); page.wait_for_selector('h1'); time.sleep(1)
    ctx.set_offline(True); page.reload(); page.wait_for_selector('h1', timeout=8000)
    check('Day' in page.inner_text('h1') or 'complete' in page.inner_text('h1'), 'app loads fully offline from service worker cache')
    check(page.evaluate('window.__app.repo.state().lessons["english-1"].completedAt!==null'), 'progress persisted in IndexedDB across offline reload')
    page.goto(BASE + '#/lesson/english-1'); page.wait_for_selector('.lhead'); check('Sentence Backbone' in page.inner_text('h1'), 'lesson content available offline')
    chip = page.inner_text('#sync-chip'); check(chip in ('Local only', 'Offline'), f'status chip offline-aware: {chip}')
    for route in ['plan', 'skills', 'skill/english', 'progress', 'mistakes', 'history', 'settings', 'reflect']:
        page.goto(BASE + '#/' + route); page.wait_for_selector('h1'); 
    check(True, 'all views render offline')
    ctx.set_offline(False)
    check(not [e for e in errors if 'Failed to load resource' not in e and 'ERR_' not in e], f'no unexpected console errors: {errors[:3]}')
    b.close()
print(f'\n{ok} checks passed')
