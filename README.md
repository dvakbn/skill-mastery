# Skill Mastery — a 60-day personal learning app (no AI)

An offline-first web app (plain HTML/CSS/JavaScript, no build step) that teaches 26 skills over 60 days and
measures what you actually *demonstrate*, not just what you click through.

- **102 complete lessons** (explanation, examples, 4 exercises, a practical task, quiz, practice bank, flashcards, reflection)
- **9 assessments** (weeks 1–8 and a final on day 60) with auto-graded questions, decision scenarios, role-plays and a written task
- **No AI anywhere.** Grading is rules and rubrics; scheduling is spaced repetition; recommendations are explicit if-then rules
- Works offline after the first load; progress is stored on the device and syncs through Supabase when you sign in

## Run it

```
node tools/serve.mjs 8765        # then open http://localhost:8765
```

Or upload the `app/` folder to any static host (GitHub Pages, Netlify, Cloudflare Pages). Everything the app
needs, including all lessons, is in `app/` (`app/data/content.json` holds the curriculum).

## Sync (Supabase)

A Supabase project named **skill-mastery** (region ap-south-1) is set up and `app/config.js` points at it.
The schema in `supabase/migrations/20261013000000_init_skill_mastery.sql` has been applied (two tables with
row-level security, 7 policies, and the `push_changes` / `reset_my_data` functions, callable only by signed-in users).
Verified against the live database: retried pushes are idempotent, a stale document write is reported as a
conflict, a correct write is accepted, and one account cannot see another account's rows. The security advisor
reports no issues.

Two settings are yours to choose in the Supabase dashboard:

1. **Authentication → Providers → Email**: keep email sign-in on, and decide whether to require email confirmation
   (if on, confirm once from your inbox before the first sign-in).
2. **Authentication → URL Configuration**: set the Site URL to wherever you host the app.

To rebuild the database elsewhere, run the SQL file in the SQL editor of a fresh project, then put that project's
URL and anon key in `app/config.js`. The anon key is public by design; row-level security limits each account to
its own rows.

## How it works

**Data model.** Every answer is an immutable *attempt* (append-only; merging two devices is a union). Mutable things
(lesson progress, settings, reflections, overrides, plan, assessment runs) are small *documents* with a version
number. Everything you see (review queue, mastery levels, recurring mistakes, plan, milestones) is recomputed
from those two sources, so two devices cannot disagree about history.

**Sync.** Plain REST calls to Supabase. Changes are pushed in one call; the server accepts a document only if its
version matches, otherwise the app merges (per document type) and keeps the losing version in a local conflict log
(Settings → Conflict log). Nothing is silently dropped. Offline edits queue and resync when you reconnect.

**Completion is not mastery.** Finishing a lesson makes it "Introduced". Mastery levels need evidence:

| Level | Name | What it takes |
|---|---|---|
| 2 | Practising | score ≥ 60% and enough evidence weight |
| 3 | Proficient | ≥ 75%, evidence on ≥ 2 days, and a successful retrieval ≥ 2 days after the lesson |
| 4 | Mastered | ≥ 85%, ≥ 3 days spanning ≥ 7, two retrievals ≥ 3 days after, no recurring mistakes, all skill lessons done |

Assessments weigh 1.6, reviews 1.2, quizzes and exercises 1.0, written 0.8, flashcards 0.6, with a 21-day half-life.
Tasks and reflections count as completion only. **Incomplete assessments are saved but never count as evidence.**

**Spaced repetition.** Correct answers move an item to 1 → 3 → interval × ease days (ease starts 2.5, floor 1.3, cap 180 days).
A miss resets it to 1 day. Same-day repeats do not inflate the interval.

**Recommendations.** Ten explicit rules (due reviews, recurring-mistake drill, remedial lesson, stretch unlock, refresh,
catch-up, assessment readiness, retake, backlog control, reflection nudge). Each shows why it fired, and you can
dismiss, snooze or override it. The full list is in Settings → How it works.

**Written answers.** You write, compare with a model answer, then rate yourself 0–3 on each rubric criterion.
Automatic checks (keywords, minimum sentences, forbidden phrases) cap a rating when the text clearly doesn't meet it.

**Plan.** Dates slide with your progress; you can jump to a day, skip an assessment or override a recommendation.

## Adding AI later (not done now)

`app/js/ai/provider.js` is a registry with a `NullProvider`. A future provider can implement `reviewWritten`, `generateItems` and `explainMistake` (see the comment at the top of that file) and be registered without touching the curriculum, database, grading or history. No AI SDKs,
keys or network calls exist in the app today.

## Export and recovery

Settings → **Backup and recovery** downloads one JSON file with every attempt and document (CSV of attempts is also available).
**Import** validates the file before merging. Signing in on a new device downloads your full history from Supabase.

## Tests

```
node tests/engine.test.mjs        # 22 checks: grading, SRS, mastery gates, mistakes, recommendations, assessment scoring
node tests/sync.test.mjs          # 9 checks: offline queue, idempotent retries, conflicts, new-device recovery (mock server)
node tools/validate-content.mjs   # every lesson/assessment against the content schema
node tools/serve.mjs 8765 &       # then:
python3 tests/ui.test.py          # 14 browser checks incl. offline reload (needs Playwright + Chromium)
python3 tests/assessment.ui.test.py   # 9 checks: start, resume, incomplete submit, retake, pass
```

## Editing content

Lessons live in `content/lessons/*.json` (generated from `tools/lessons/*.mjs` via `tools/dsl.mjs`); assessments in
`content/assessments/` (from `tools/assess/`). After changing content run
`node tools/fix-content.mjs && node tools/validate-content.mjs && node tools/build-content.mjs`.
The format is described in `CONTENT_SPEC.md`.

## Known limits (honest list)

- The database functions and row isolation were tested directly in Supabase, but the full browser-to-Supabase sign-in
  and sync round trip has not been run end to end. Try it once with two browsers after choosing the email setting.
- Lessons were written for you as a learning programme, not reviewed by a subject expert. Treat the SAP/ABAP and
  finance material as introductory, and check anything you plan to act on.
- Self-scored written answers are only as honest as the rating you give; the model answer and rubric are there to help.
- Not tested on iOS Safari; installation as an app uses the standard web-app manifest.
