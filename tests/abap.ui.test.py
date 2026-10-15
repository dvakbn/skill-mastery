"""ABAP diagnostic UI test. Usage: node tools/serve.mjs 8765 &  python3 tests/abap.ui.test.py"""
import sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'; ok = 0; errors = []
def check(c, m):
    global ok
    if not c: print('  ✗', m); sys.exit(1)
    ok += 1; print('  ✓', m)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 420, 'height': 900}, permissions=['clipboard-read', 'clipboard-write']); page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(BASE + '#/abap'); page.wait_for_selector('text=Start the diagnostic')
    check('Locked until you finish' in page.inner_text('.view'), 'hub shows diagnostic and locked plan')
    page.click('text=Start the diagnostic'); page.wait_for_selector('.card.ex')
    check(page.locator('.card.ex').count() >= 4 and page.locator('.opt.dk').count() == page.locator('.card.ex').count(), 'quiz section renders with an I-don\'t-know option each')
    page.locator('.card.ex').nth(0).locator('.opt').nth(0).click(); page.locator('.card.ex').nth(1).locator('.opt.dk').click()
    page.wait_for_function('document.querySelectorAll(".steps .step small")[0].textContent.startsWith("2/")')
    check(True, 'answers counted in the area tab')
    page.reload(); page.wait_for_selector('.card.ex')
    check(page.locator('.card.ex').nth(0).locator('.opt.sel').count() == 1 and page.locator('.card.ex').nth(1).locator('.opt.dk.sel').count() == 1, 'answers survive reload')
    page.click('text=Submit diagnostic'); page.wait_for_selector('text=Submit anyway?'); page.click('dialog.dlg button:has-text("Submit")')
    page.wait_for_selector('text=ABAP diagnostic — results')
    check('By area' in page.inner_text('.view') and 'Concepts to fix first' in page.inner_text('.view'), 'results show areas and concepts to fix')
    page.click('text=Copy summary'); t = page.evaluate('navigator.clipboard.readText()')
    check(len(t) > 100 and 'weak' in t.lower(), 'summary copied')
    page.goto(BASE + '#/abap'); page.wait_for_selector('text=View last result')
    check('your 30-day plan' in page.inner_text('.view').lower() and 'locked' not in page.inner_text('.view').lower(), 'hub shows saved result and plan unlocked')
    check(not errors, 'no console errors ' + str(errors[:2]))
    b.close()
print(ok, 'passed')
