# Content spec for lesson and assessment writers

You are writing finished, learner-ready curriculum content for a self-study app used by one adult learner (an MCA student in India preparing for an entry-level SAP ABAP consultant role at IT services firms; strong web-dev background). All content must stand alone: **no URLs, no "visit/watch/search this website", no dependence on external resources**. No placeholders, no "TBD", no "etc." padding. Every sentence must teach something. Write in clear, warm, practical British/Indian-friendly English. Examples should be realistic for a student/early-career professional in India (rupees, UPI, college projects, IT-services teams, client calls) when natural, never forced.

Facts: use stable, well-established facts only. Never state current office-holders, current rates, prices, rankings or "latest" statistics. Where numbers change (tax, interest rates), teach the principle and use clearly illustrative figures. Health topics (stress, grooming) are general wellbeing only, no diagnosis; mention seeking a professional where relevant. Finance content is educational, not personalised advice.

## Files
- Lesson: `content/lessons/<skillId>-<n>.json` (e.g. `tech-2.json` is named `tech-2.json`). Titles and focus come from `content/skills.json` (title must match exactly). Day placement is in `content/curriculum.json` (`lessonDay`); lessons in the same skill are spaced weeks apart, so each lesson should briefly recall the previous one in the skill (one sentence) but be understandable alone.
- **Reference exemplar**: `content/lessons/english-1.json`. Match its structure, depth, and quality exactly. Read it first.
- Validate with `node tools/validate-content.mjs <lessonId> [more ids]`. Fix every problem. Run it before you finish. It must print OK.

## Lesson object (all fields required)
`id, skillId, n, title, summary, difficulty(1-3; 1 for n=1 rising to 2-3 for later lessons), minutes{concept:7,examples:3,practice:9,task:6,quiz:3}, objectives[3], concepts[3-4 of {id:"<skillId>.<kebab>", label}], explanation[3-5 of {heading, body}], examples[2-3 of {title, body, takeaway}], exercises[4], task, quiz[4], bank[3], cards[4], reflection, revision{keyPoints[3-6], redo}`.

- **explanation**: 380-800 words total. Concrete, specific, with at least one worked example inside the text. `body` is markdown-lite: paragraphs separated by `\n\n`, `**bold**`, `*italic*`, `- ` bullet lines, `1. ` numbered lines, and triple-backtick code fences (allowed for tech content). Teach the concept, the method, the common mistake, and how to practise.
- **examples**: realistic worked examples (before/after, annotated scripts, calculations). `takeaway` states what to notice.
- **exercises** (exactly 4, ids `<lessonId>.e1..e4`, levels 1,1,2,3 in that order): e1/e2 guided and auto-gradable (`mcq`, `fill`, or `scenario`); e3 level 2; e4 level 3 stretch. At least one `written`. Use `scenario` (decision-making) and `roleplay` for people skills; use `fill` with accepted answers for English/finance/technical items; use `written` for writing and reasoning tasks. Vary types across the four.
- **task**: a real-world practical task (6 minutes) the learner does off-screen, then logs evidence. `{title, brief, steps[3-6], checklist[3-6], evidencePrompt, evidenceWords (8-60), minutes:6}`.
- **quiz** (4, ids `.q1..q4`): `mcq` or `fill`, covering every concept. These are the in-lesson mastery check.
- **bank** (3, ids `.b1..b3`): `mcq` or `fill` application/transfer questions in NEW contexts (different from the quiz). Used later for spaced review and weekly assessments, so each must make sense with no lesson context on screen.
- **cards** (4, ids `.c1..c4`): flashcards `{id, concept, front, back}` for spaced repetition; back is a crisp answer (<=40 words).
- **reflection**: one thoughtful prompt tied to this lesson (shown daily with the reflection form).
- **revision**: `keyPoints` (3-6 one-line recap bullets) and `redo` (a 2-minute repeat action to do at later spaced reviews).

## Item types and exact shapes
All items need `id, type, concept` (must be one of the lesson's concept ids), `prompt`, and `why`. `why` = answer guidance: why the right answer is right AND, for mcq, why the tempting wrong ones are wrong.
- `mcq`: `options` (3-4 distinct strings), `answer` (index), optional `hint`. **Vary the correct position** across items (use indexes 0,1,2,3, not mostly 1 or 2).
- `fill`: `accept` array of normalised-acceptable answers (lower-case; the app lowercases, trims, collapses spaces, strips trailing punctuation; include plausible spelling/format variants such as "₹1,200", "1200"). The prompt must make the expected form unambiguous. Numeric answers: include variants.
- `scenario`: `options` 3-4 of `{text, score 0-3, feedback}`; exactly one best (3), at least one weak (0 or 1); plausible distractors; `why` explains the reasoning.
- `roleplay`: `setup` (who you are, who they are, goal), `turns` 3-4 of `{they, options:[exactly 3 of {text, score 0-3, feedback, reply}]}`. `they` is what the counterpart says at that turn; `reply` is how the counterpart reacts after the learner picks that option (it should sound natural, and feel like a consequence). Each turn has a 3, and a 0 or 1. Turn 2's `they` should follow naturally from a reasonable turn-1 reply.
- `written`: `minWords` (typically 20-80), `rubric` of 3-5 criteria `{id, label, weight (integers, sum exactly 100), descriptors{"0","1","2","3"} (each describes observable quality), optional auto}`, `modelAnswer`, `guidance` (what strong looks like, common mistakes, how to score honestly; 40+ words). `auto` is an optional machine check that caps a criterion at 1 if not met: `{type:"keywords", any:[...], min:n, label}` (at least n of the words/phrases, case-insensitive, appear), `{type:"forbidden", patterns:[...], label}` (none may appear), `{type:"minSentences", min:n, label}`, `{type:"regex", pattern, flags, label}`. Use auto only when a mechanical check is a fair proxy; descriptors are for the learner's self-rating against the model answer.

## Quality bar
1. Distractors in mcq must be plausible misconceptions, not jokes. Wrong options should reflect real mistakes.
2. Scenario/roleplay best options must be genuinely best, not just the longest. Vary which option is best.
3. Written prompts must have a concrete situation and a checkable deliverable.
4. Teach technique, not platitudes. Prefer frameworks with steps, worked examples, scripts, and counter-examples.
5. Calculations must be right; verify arithmetic.
6. No lesson text should say "as an AI", mention being generated, or refer to the app's own screens.
7. JSON must be valid. Escape double quotes inside strings (use \" ) or use single quotes/typographic quotes in prose. Write each file with a single Write call (or a Node script that writes JSON.stringify output) and validate.
8. Do not edit files other than your own assigned lesson files. Do not touch the validator or other lessons.

When finished, reply with ONE short line: the lesson ids written and "validated OK" (or list any you could not get to validate).
