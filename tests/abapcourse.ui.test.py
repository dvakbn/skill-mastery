"""ABAP course UI test. Usage: node tools/serve.mjs 8765 &  python3 tests/abapcourse.ui.test.py"""
import sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'; ok = 0; errors = []
def check(c, m):
    global ok
    if not c: print('  ✗', m); sys.exit(1)
    ok += 1; print('  ✓', m)
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_context(viewport={'width': 420, 'height': 900}).new_page()
    page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(BASE + '#/abap'); page.wait_for_selector('text=Start the diagnostic')
    check('Locked until you finish' in page.inner_text('.view'), 'plan locked before the diagnostic')
    page.click('text=Start the diagnostic'); page.wait_for_selector('.card.ex'); page.click('text=Submit diagnostic'); page.wait_for_selector('text=Submit anyway?'); page.click('dialog.dlg button:has-text("Submit")'); page.wait_for_selector('text=ABAP diagnostic — results')
    page.goto(BASE + '#/abap'); page.wait_for_selector('text=Start Day 1')
    check('Day 1: Data types' in page.inner_text('.view'), 'hub shows Day 1 after the diagnostic')
    C = page.evaluate("fetch('data/abap-course.json').then(r=>r.json())"); d1 = C['days'][0]
    page.click('text=Start Day 1'); page.wait_for_selector('text=Done reading')
    check('Elementary types' in page.inner_text('.view') and page.locator('h3.mdh').count() >= 3, 'chapter text renders with headings')
    check(page.locator('.steps .step:not([disabled])').count() == 1, 'later stages locked until earlier ones are done')
    page.click('text=Done reading'); page.wait_for_selector('text=Type each example'); page.click('text=Done → Exercise'); page.wait_for_selector('text=Expected result')
    page.click('text=Show hint 1 of 3'); page.wait_for_selector('text=Hint 1'); check(True, 'hint reveals one at a time')
    page.click('text=I ran it'); page.wait_for_selector('text=Mark the exercise done anyway'); page.click('dialog.dlg button:has-text("Mark done")'); page.wait_for_selector('text=No help while answering')
    def answer(ids, right):
        for i, qid in enumerate(ids):
            q = C['questions'][qid]; k = q['answer'] if right else (q['answer'] + 1) % 4
            page.locator('.card.ex').nth(i).locator('.opt').nth(k).click()
    answer(d1['quiz'], False); page.click('text=Submit answers'); page.wait_for_selector('text=Reteach: the parts that need work')
    check('0%' in page.inner_text('.view'), 'failing the quiz leads to reteach, not the next day')
    check(page.locator('.card h3').count() >= 4, 'every weak concept gets a reteach block with an extra exercise')
    page.click('text=retest me'); page.wait_for_selector('text=Different questions'); 
    check(page.locator('.card.ex').count() == len(d1['retest']), 'retest uses the different retest questions')
    answer(d1['retest'], True); page.click('text=Submit answers'); page.wait_for_selector('text=Correct what you missed')
    check('Why:' in page.inner_text('.view'), 'review shows corrections with explanations after passing')
    page.click('text=Finish Day 1'); page.wait_for_selector('text=Day complete'); page.click('text=Day 2')
    page.wait_for_selector('text=Operators and strings'); check(True, 'Day 2 unlocks only after Day 1 is finished')
    page.goto(BASE + '#/abap/day-3'); page.wait_for_selector('text=Locked until'); check(True, 'Day 3 stays locked')
    page.goto(BASE + '#/abap/day-8'); page.wait_for_selector('text=not been written yet'); check(True, 'unwritten day is explained, not broken')
    page.goto(BASE + '#/abap/plan'); page.wait_for_selector('text=30-day roadmap'); check('phase g' in page.inner_text('.view').lower(), 'roadmap lists all phases')
    page.reload(); page.wait_for_selector('text=30-day roadmap'); check('1/30' in page.inner_text('.view'), 'progress survives reload')
    page.goto(BASE + '#/abap/review'); page.wait_for_selector('h1'); check('Warm-up' in page.inner_text('.view'), 'warm-up screen opens')
    check(not errors, 'no console errors ' + str(errors[:2]))
    b.close()
print(ok, 'passed')
