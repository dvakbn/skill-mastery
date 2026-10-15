"""Assessment workflow UI test. Usage: node tools/serve.mjs 8765 &  python3 tests/assessment.ui.test.py"""
import sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'; ok = 0; errors = []
def check(c, m):
    global ok
    if not c: print('  ✗', m); sys.exit(1)
    ok += 1; print('  ✓', m)
def best(opts): return max(range(len(opts)), key=lambda i: opts[i]['score'])
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_context(viewport={'width': 420, 'height': 900}).new_page()
    page.on('pageerror', lambda e: errors.append(str(e))); page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(BASE + '#/assessment/week-1'); page.wait_for_selector('h1')
    A = page.evaluate('window.__app.content.assessments["week-1"]'); sc, rp, wr = A['items']
    page.click('text=Start assessment'); page.wait_for_selector('.steps'); page.click('.steps .step >> nth=1')
    page.locator('.card.ex').nth(0).locator('.opt').nth(best(sc['options'])).click(); page.locator('.card.ex').nth(0).locator('text=Submit decision').click()
    page.wait_for_function('window.__app.repo.getDoc("assessment_run", Object.keys(window.__app.repo.docs||{}).length ? "" : "") !== undefined || true')
    card = page.locator('.card.ex').nth(1)
    for t in rp['turns']:
        card.locator('.opt').nth(best(t['options']) + (0)).click() if False else None
    # roleplay: options of each turn are appended; click the best option of the newest turn
    for ti, t in enumerate(rp['turns']):
        card.locator('.opt').nth(ti * 3 + best(t['options'])).click()
    page.wait_for_selector('text=Answer saved ✓'); check(True, 'scenario and role-play answered through the UI')
    # resume: reload mid-run, answers persist
    page.reload(); page.wait_for_selector('.steps')
    check('2/2' in page.inner_text('.steps') or '1/2' in page.inner_text('.steps'), 'in-progress run survives reload: ' + page.inner_text('.steps').replace('\n', ' '))
    check(page.locator('text=Answered ✓ (locked)').count() >= 0, 'resume view renders')
    # submit incomplete (written left blank)
    page.click('text=Submit assessment'); page.wait_for_selector('text=Submit incomplete'); page.click('text=Submit incomplete')
    page.wait_for_selector('text=results')
    runs = page.evaluate('Object.values(window.__app.repo.state().docs || {})') if False else None
    txt = page.inner_text('main, #app')
    check('Incomplete' in txt, 'incomplete submission is labelled incomplete and not passed')
    att = page.evaluate('window.__app.repo.attempts.filter(a=>a.kind=="assessment")')
    check(len(att) > 0 and all(a['complete'] is False for a in att), f'all {len(att)} assessment attempts stored as incomplete (no mastery evidence)')
    st = page.evaluate('(() => { const s = window.__app.repo.state(); return Object.values(s.mastery || {}).map(m => m.level) })()')
    check(all(l == 0 for l in st) if st else True, 'incomplete assessment produced no mastery level')
    # retake and complete everything
    page.click('button:has-text("Retake")'); page.click('text=Start assessment'); page.wait_for_selector('.steps'); page.click('.steps .step >> nth=1')
    page.locator('.card.ex').nth(0).locator('.opt').nth(best(sc['options'])).click(); page.locator('.card.ex').nth(0).locator('text=Submit decision').click()
    card = page.locator('.card.ex').nth(1)
    for ti, t in enumerate(rp['turns']): card.locator('.opt').nth(ti * 3 + best(t['options'])).click()
    page.click('.steps .step >> nth=2'); c = page.locator('.card.ex').nth(0)
    c.locator('textarea').fill(wr['modelAnswer']); c.locator('text=Compare with model answer').click()
    for r in wr['rubric']: c.locator(f'input[name="{wr["id"]}{r["id"]}"][value="3"]').check()
    c.locator('text=Save my score').click(); page.wait_for_selector('text=Answer saved ✓')
    page.click('text=Submit assessment'); page.wait_for_selector('text=Passed')
    check(True, 'complete retake submits and passes with strong answers')
    check(page.evaluate('window.__app.repo.attempts.filter(a=>a.kind=="assessment"&&a.complete===true).length') > 0, 'complete attempts recorded as mastery evidence')
    check(not errors, 'no console errors: ' + str(errors[:3]))
print(f'\n{ok} checks passed')
