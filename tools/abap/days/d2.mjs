import { code, Q } from '../dsl.mjs';
export default {
  n: 2, phase: 'A', title: 'Operators and strings',
  goal: 'Calculate correctly with integers and decimals, and handle text with the everyday string tools.',
  objectives: ['Predict integer arithmetic including rounding, DIV and MOD', 'Get decimals by using a p variable', 'Join, trim and measure text', 'Cut parts of text with offset and length', 'Compare text with CS and CP'],
  minutes: { read: 15, examples: 10, exercise: 20, quiz: 8, review: 7 },
  read: `## Arithmetic and the result type
§+ - * /§ and §**§ (power) work as you expect, but **the type of the target decides how the answer looks**:
- into an **i** variable, §7 / 2§ is **rounded** to **4** (not cut to 3);
- into a **p** variable with 2 decimals, §7 / 2§ is **3.50**.

Whole-number division and remainder have their own operators: §7 DIV 2§ = **3**, §7 MOD 2§ = **1**. They are what you use for "every 3rd row", even/odd checks and splitting seconds into minutes.

Every operator needs spaces around it: §a+b§ is wrong, §a + b§ is right.

## Text tools
- Join: §CONCATENATE a b INTO c SEPARATED BY space.§ or a **string template** §|Hello { lv_name }|§. Templates are the modern default.
- Length: §strlen( lv )§.
- Clean up: §CONDENSE lv.§ removes leading and trailing spaces and shrinks runs of spaces to one. §to_upper( lv )§ / §to_lower( lv )§ change case.
- Replace: §replace( val = lv sub = 'a' with = 'b' occ = 0 )§ (occ = 0 means all).
- **Offset and length**: §lv+3(4)§ means "start after 3 characters, take 4". Counting starts at **0**.

## Comparing text
- §CS§ contains string, **not** case-sensitive. It fills §sy-fdpos§ with the position found.
- §CP§ matches a pattern: §*§ is any run of characters, §+§ exactly one.
- §=§ compares case-sensitively and ignores trailing blanks in c fields.

## Habit
When the result must keep decimals, **declare the target as p**, never i.`,
  examples: [
    { title: 'Rounding, DIV, MOD', code: code("DATA: gv_int TYPE i, gv_div TYPE i, gv_mod TYPE i.\nDATA gv_dec TYPE p LENGTH 8 DECIMALS 2.\n\ngv_int = 7 / 2.     \" 4  (rounded, not 3)\ngv_dec = 7 / 2.     \" 3.50\ngv_div = 7 DIV 2.   \" 3\ngv_mod = 7 MOD 2.   \" 1\nWRITE: / gv_int, / gv_dec.\nWRITE: / gv_div, / gv_mod.   \" 3 and 1"), notes: 'Same expression, different targets, different answers. This is the integer-arithmetic trap.' },
    { title: 'Join and template', code: code("DATA: gv_first TYPE c LENGTH 10 VALUE 'Deepak',\n      gv_last  TYPE c LENGTH 10 VALUE 'Raj',\n      gv_full  TYPE string.\n\nCONCATENATE gv_first gv_last INTO gv_full SEPARATED BY space.\nWRITE: / gv_full.                       \" Deepak Raj\ngv_full = |Welcome, { gv_first }!|.\nWRITE: / gv_full.                       \" Welcome, Deepak!"), notes: 'In templates, trailing blanks of a c field are not added.' },
    { title: 'Clean and measure', code: code("DATA gv_messy TYPE string VALUE §   too   many    spaces  §.\nCONDENSE gv_messy.\nWRITE: / gv_messy.             \" too many spaces\nWRITE: / strlen( gv_messy ).   \" 15"), notes: 'CONDENSE changes the variable itself. NO-GAPS would remove every space.' },
    { title: 'Offset and CS', code: code("DATA gv_code TYPE c LENGTH 7 VALUE 'SAPABAP'.\nWRITE: / gv_code+0(3).   \" SAP\nWRITE: / gv_code+3(4).   \" ABAP\n\nIF gv_code CS 'abap'.\n  WRITE: / 'found at', sy-fdpos.   \" found at 3\nENDIF."), notes: 'Offset 3 means three characters skipped. CS ignores case, so \'abap\' matches.' }
  ],
  exercise: {
    title: 'Numbers and names',
    brief: 'Prove the rounding rule and build a small text-cleaning program.',
    steps: ['Create **ZABAP_D2** in SE38.', 'Calculate **7 / 2** into an **i** variable and into a **p** (8, 2 decimals) variable, and also print **7 DIV 2** and **7 MOD 2**.', 'Join first name and last name (your own) with one space into a string and also build a greeting with a string template.', 'Store the text <three spaces>too<three spaces>many<four spaces>spaces<two spaces> in a string (use a backtick literal), CONDENSE it, and print it and its length.', 'Take **\'SAPABAP\'** and print the first three characters and the last four using offset/length.', 'Test whether your full name contains \'raj\' with **CS**, and print the position from **sy-fdpos**.'],
    expect: ['Integer result **4**; decimal result **3.50**; DIV **3**; MOD **1**', 'Full name and greeting both correct', '**too many spaces** with length **15**', '**SAP** and **ABAP**', 'CS true (it ignores case) and a position number printed'],
    hints: ['Use two targets: §DATA gv_int TYPE i.§ and §DATA gv_dec TYPE p LENGTH 8 DECIMALS 2.§ and assign the same §7 / 2§ to both.', 'Declare it TYPE string and write the literal in backticks (the key left of 1) so the spaces are kept; single quotes would drop trailing blanks.', 'Offset counting starts at 0: first three = §lv+0(3)§, last four = §lv+3(4)§.'],
    solution: code("REPORT zabap_d2.\n\nDATA: gv_int   TYPE i,\n      gv_div   TYPE i,\n      gv_mod   TYPE i,\n      gv_dec   TYPE p LENGTH 8 DECIMALS 2,\n      gv_first TYPE c LENGTH 10 VALUE 'Deepak',\n      gv_last  TYPE c LENGTH 10 VALUE 'Raj',\n      gv_full  TYPE string,\n      gv_greet TYPE string,\n      gv_messy TYPE string VALUE §   too   many    spaces  §,\n      gv_code  TYPE c LENGTH 7 VALUE 'SAPABAP'.\n\ngv_int = 7 / 2.\ngv_dec = 7 / 2.\ngv_div = 7 DIV 2.\ngv_mod = 7 MOD 2.\nWRITE: / gv_int, / gv_dec, / gv_div, / gv_mod.\n\nCONCATENATE gv_first gv_last INTO gv_full SEPARATED BY space.\ngv_greet = |Welcome, { gv_first }!|.\nWRITE: / gv_full, / gv_greet.\n\nCONDENSE gv_messy.\nWRITE: / gv_messy, / strlen( gv_messy ).\n\nWRITE: / gv_code+0(3), / gv_code+3(4).\n\nIF gv_full CS 'raj'.\n  WRITE: / 'found at', sy-fdpos.\nENDIF."),
    stretch: { brief: 'Use §replace( )§ to turn "Deepak Raj" into "Deepak-Raj", and §to_upper( )§ to print it in capitals. Then write one line that prints how many characters your full name has.', solution: '§gv_full = replace( val = gv_full sub = \' \' with = \'-\' occ = 0 ).§  §WRITE / to_upper( gv_full ).§  §WRITE / strlen( gv_full ).§' }
  },
  tags: {
    'd2.intmath': { title: 'Integer arithmetic and rounding', reteach: `When the target is **i**, the answer is a whole number and ABAP **rounds** (half away from zero): §gv_int = 7 / 2.§ gives **4**, and §gv_int = 10 / 4.§ gives **3** (2.5 rounds to 3).\n\nWant the cut-off instead? Use §DIV§: §7 DIV 2§ = 3. Want the remainder? §MOD§: §7 MOD 2§ = 1.\n\nWhen decimals matter, make the target a **p** with DECIMALS: then §7 / 2§ = 3.50.`, extra: { brief: 'Predict, then run: §DATA i TYPE i. i = 9 / 2. WRITE i.§ and §WRITE / 9 DIV 2. WRITE / 9 MOD 2.§', solution: '9 / 2 = 4.5 rounds to 5; DIV gives 4; MOD gives 1.' } },
    'd2.divmod': { title: 'DIV, MOD and decimals', reteach: `§DIV§ = whole-number quotient, §MOD§ = remainder. Together they rebuild the number: §( 17 DIV 5 ) * 5 + 17 MOD 5§ = 17.\n\nCommon uses: every nth item (§sy-index MOD 3 = 0§), even/odd (§MOD 2§), turning 125 minutes into 2 hours and 5 minutes (§125 DIV 60§, §125 MOD 60§).\n\nFor **decimals** use a **p** variable with DECIMALS; **i** can never hold a fraction.`, extra: { brief: 'Turn 3725 seconds into hours, minutes and seconds with DIV and MOD only.', solution: '3725 DIV 3600 = 1 hour; (3725 MOD 3600) DIV 60 = 2 minutes; 3725 MOD 60 = 5 seconds.' } },
    'd2.strings': { title: 'CONCATENATE, CONDENSE, templates, strlen', reteach: `Join: §CONCATENATE a b INTO c SEPARATED BY space.§ or, preferred, a template §|{ a } { b }|§.\n§CONDENSE c.§ trims both ends and shrinks inner runs of spaces to one (changes the variable itself).\n§strlen( c )§ counts characters (trailing blanks of a c field do not count).\n\nCase: §to_upper( c )§ and §to_lower( c )§.`, extra: { brief: 'Build "SAP ABAP 2026" from three separate variables using a template, then print its length.', solution: '§DATA(lv) = |{ a } { b } { c }|. WRITE strlen( lv ).§ gives 14.' } },
    'd2.offset': { title: 'Offset, length and CS/CP', reteach: `§lv+3(4)§: skip 3 characters, take 4. The first character is at offset **0**.\n§CS§ means "contains string" and ignores case; on success §sy-fdpos§ holds the offset where it was found.\n§CP§ is pattern match: §*§ any characters, §+§ one character. §'SAPABAP' CP 'SAP*'§ is true.\n\nFor safety, check the length first: asking for more characters than exist is a runtime error.`, extra: { brief: 'Does §\'invoice_2026\' CP \'invoice*\'§ hold? What does §\'invoice_2026\' CS \'VOICE\'§ give and what is sy-fdpos?', solution: 'Both are true; sy-fdpos = 2 (position of "voice" after "in").' } }
  },
  quiz: [
    Q('d2.intmath', 'What is stored in gv_int?\n' + code("DATA gv_int TYPE i.\ngv_int = 7 / 2."), '4', ['3', '3.5', '3.50'], 'ABAP rounds the result when it is stored in an integer, so 3.5 becomes 4.'),
    Q('d2.intmath', 'What is stored in gv_int?\n' + code("DATA gv_int TYPE i.\ngv_int = 10 / 4."), '3', ['2', '2.5', '4'], '2.5 is rounded to the nearest whole number, away from zero: 3.'),
    Q('d2.divmod', 'What do §17 DIV 5§ and §17 MOD 5§ give, in that order?', '3 and 2', ['2 and 3', '3.4 and 0', '3 and 3'], 'DIV is the whole quotient (3 fives) and MOD the remainder (17 - 15 = 2).'),
    Q('d2.divmod', 'You need the result 3.50 from 7 / 2. What must change?', 'Declare the target as p with 2 decimals', ['Declare the target as i', 'Use MOD instead of /', 'Use a longer c field'], 'An i variable can only hold whole numbers; a p with DECIMALS can hold 3.50.'),
    Q('d2.strings', 'What does §WRITE strlen( lv ).§ show after this?\n' + code("DATA lv TYPE string VALUE §  a   b  §.\nCONDENSE lv."), '3', ['6', '1', '10'], 'CONDENSE trims the ends and reduces inner spaces to one, leaving "a b" with 3 characters.'),
    Q('d2.offset', 'What does this print?\n' + code("DATA lv TYPE c LENGTH 7 VALUE 'SAPABAP'.\nWRITE lv+3(4)."), 'ABAP', ['SAPA', 'APAB', 'BAP'], 'Offset 3 skips S, A, P; length 4 takes A, B, A, P.')
  ],
  retest: [
    Q('d2.intmath', 'What is stored in gv_int?\n' + code("DATA gv_int TYPE i.\ngv_int = 9 / 2."), '5', ['4', '4.5', '9'], '4.5 is rounded up to 5 when stored in an integer.'),
    Q('d2.divmod', 'Which expression is true only for even numbers?', 'sy-index MOD 2 = 0', ['sy-index DIV 2 = 0', 'sy-index / 2 = 1', 'sy-index MOD 2 = 1'], 'An even number has no remainder when divided by 2.'),
    Q('d2.strings', 'Which line produces "Hello Deepak" if lv_name = \'Deepak\'?', '|Hello { lv_name }|', ['\'Hello { lv_name }\'', '|Hello lv_name|', 'Hello & lv_name'], 'Only a string template with curly braces inserts the variable value.'),
    Q('d2.offset', 'What does §IF \'invoice_2026\' CS \'VOICE\'.§ evaluate to?', 'True, because CS ignores case', ['False, because the case differs', 'A syntax error', 'True only for CP'], 'CS (contains string) is not case-sensitive, so VOICE matches the voice inside invoice.')
  ],
  milestone: 'You can predict integer vs decimal results and clean and slice text without trial and error.'
};
