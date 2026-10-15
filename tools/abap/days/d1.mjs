import { code, Q } from '../dsl.mjs';
export default {
  n: 1, phase: 'A', title: 'Data types and declarations',
  goal: 'Declare variables, constants, types and structures correctly, and know exactly how long each one is.',
  objectives: ['State the default length of type c and what happens when a longer text is assigned', 'Use n, i, p, string, d, t for the right job', 'Tell DATA, CONSTANTS and TYPES apart', 'Build and use a structure', 'Use inline declarations and know what type they get'],
  minutes: { read: 15, examples: 10, exercise: 20, quiz: 8, review: 7 },
  read: `## The idea
Every variable in ABAP has a **type** that fixes what it can hold and how long it is. Most beginner bugs in ABAP come from guessing a type or a length.

## Elementary types you will use every day
- **c** — fixed-length text. §DATA x TYPE c.§ has **length 1**, not "any length". Write §TYPE c LENGTH 20§ for 20 characters. Assigning a longer text silently **cuts it off**.
- **string** — text of any length. Use it when you do not know the size.
- **n** — a *number-text*: only digits, stored as characters, padded with leading zeros (§'42'§ in a §n LENGTH 5§ becomes §00042§). Use it for codes such as postal codes, not for arithmetic.
- **i** — whole numbers (about ±2 billion).
- **p** — packed number with decimals: §TYPE p LENGTH 8 DECIMALS 2§. Use it for money and quantities.
- **d** (date, §YYYYMMDD§) and **t** (time, §HHMMSS§).

## DATA, CONSTANTS, TYPES
- §DATA§ reserves memory for a variable.
- §CONSTANTS§ reserves memory for a value that **cannot change**; it needs a §VALUE§, and assigning to it is a syntax error.
- §TYPES§ only **describes** a shape. No memory is reserved until you write §DATA x TYPE that_type§.

## Structures
A structure is one record with several named fields. Define it once with §TYPES BEGIN OF … END OF§, then create a variable of that type and reach each field with a dash: §gs_emp-name§.

## Inline declarations (S/4HANA)
§DATA(lv_x) = 5.§ declares and fills a variable in one step; the type is taken from the right side. Careful: §DATA(lv_t) = 'Hi'.§ gives a **c of length 2**, so a longer text assigned later is cut off. For a text that can grow, use a string: write the literal in backticks, or declare §DATA lv_s TYPE string.§

## Naming habit
§gv_§ global variable, §lv_§ local, §gs_§ structure, §gt_§ table, §gc_§ constant, §ty_§ type. Readers (and interviewers) notice.`,
  examples: [
    { title: 'Length of c', code: code("DATA gv_long  TYPE c LENGTH 20.\nDATA gv_short TYPE c.\n\ngv_long  = 'Deepak'.\ngv_short = 'Deepak'.\n\nWRITE: / gv_long.   \"Deepak\nWRITE: / gv_short.  \"D   (length 1: the rest is cut off)"), notes: 'No error, no warning: the text is just truncated. This is the classic type c trap.' },
    { title: 'n keeps leading zeros', code: code("DATA gv_zip TYPE n LENGTH 6.\ngv_zip = '1234'.\nWRITE: / gv_zip.    \"001234"), notes: 'Digits only. Anything that is not a digit is dropped on assignment.' },
    { title: 'TYPES describes, DATA allocates, CONSTANTS stays fixed', code: code("TYPES ty_amount TYPE p LENGTH 8 DECIMALS 2.   \" only a description\nDATA  gv_price  TYPE ty_amount.               \" real variable\nCONSTANTS gc_tax TYPE p LENGTH 8 DECIMALS 2 VALUE '0.18'.\n\ngv_price = '19.99'.\n\" gc_tax = '0.20'.   <- syntax error: constants cannot change"), notes: 'Reuse one TYPES in many DATA lines so a change of length happens in one place.' },
    { title: 'A structure', code: code("TYPES: BEGIN OF ty_item,\n         code  TYPE n LENGTH 6,\n         name  TYPE c LENGTH 20,\n         price TYPE p LENGTH 8 DECIMALS 2,\n       END OF ty_item.\n\nDATA gs_item TYPE ty_item.\ngs_item-code = '1234'.\ngs_item-name = 'Keyboard'.\nWRITE: / gs_item-code, gs_item-name."), notes: 'One variable, three fields. You will use this shape for every table row later.' }
  ],
  exercise: {
    title: 'Declare, fill and print',
    brief: 'In SAP Logon create a new program and prove to yourself how types and lengths behave.',
    steps: ['Open transaction **SE38**. Program name **ZABAP_D1** (Z or Y names are customer namespace). Create → type **Executable program** → save as **Local object** ($TMP).', 'Declare: a text of length 20 holding your name; a second text declared **without LENGTH**; a **n LENGTH 6**; a structure **ty_item** (code n6, name c20, price p 8 decimals 2); a constant **gc_tax** = 0.18; and **gv_total** as p 8 decimals 2.', 'Assign your name to **both** text variables, set the item to code 1234, name Keyboard, price 19.99, and compute **gv_total = price * ( 1 + gc_tax )**.', 'Print every value with WRITE, one per line.', 'Activate (**Ctrl+F3**) and run (**F8**). Compare with the expected output below.'],
    expect: ['Name line shows your full name', 'The no-LENGTH text shows only the **first letter**', 'Code shows **001234**', 'Price shows **19.99**', 'Tax shows **0.18**', 'Total shows **23.59**'],
    hints: ['Use §DATA gv_letter TYPE c.§ for the one-letter variable and assign your name to it.', 'The structure fields are written §gs_item-code§, §gs_item-name§, §gs_item-price§.', 'Write the formula as §gv_total = gs_item-price * ( 1 + gc_tax ).§ Spaces around every parenthesis and operator are mandatory in ABAP.'],
    solution: code("REPORT zabap_d1.\n\nCONSTANTS gc_tax TYPE p LENGTH 8 DECIMALS 2 VALUE '0.18'.\n\nTYPES: BEGIN OF ty_item,\n         code  TYPE n LENGTH 6,\n         name  TYPE c LENGTH 20,\n         price TYPE p LENGTH 8 DECIMALS 2,\n       END OF ty_item.\n\nDATA gv_name   TYPE c LENGTH 20.\nDATA gv_letter TYPE c.\nDATA gs_item   TYPE ty_item.\nDATA gv_total  TYPE p LENGTH 8 DECIMALS 2.\n\ngv_name   = 'Deepak'.\ngv_letter = 'Deepak'.\ngs_item-code  = '1234'.\ngs_item-name  = 'Keyboard'.\ngs_item-price = '19.99'.\ngv_total = gs_item-price * ( 1 + gc_tax ).\n\nWRITE: / 'Name  :', gv_name.\nWRITE: / 'Letter:', gv_letter.\nWRITE: / 'Code  :', gs_item-code.\nWRITE: / 'Price :', gs_item-price.\nWRITE: / 'Tax   :', gc_tax.\nWRITE: / 'Total :', gv_total."),
    stretch: { brief: 'Add §DATA(lv_text) = \'Hello\'.§ then assign §\'Hello world\'§ to it and print it. Predict the output first, then explain it. Fix it so the full text survives.', solution: 'lv_text is type c length 5, so the output is "Hello". Declare §DATA lv_text TYPE string.§ and the full "Hello world" is kept.' }
  },
  tags: {
    'd1.types': { title: 'Type c length and n', reteach: `**Type c has length 1 unless you say otherwise.** §DATA x TYPE c.§ then §x = 'ABC'.§ leaves §A§. Nothing warns you; the text is cut to fit.\n\nFix: give a length (§TYPE c LENGTH 10§) or use §string§ when the size is unknown.\n\n**Type n** is text that only holds digits and pads with leading zeros: §n LENGTH 5§ with §'42'§ is §00042§. It is for codes (postal codes, material numbers), not for calculating.`, extra: { brief: 'Predict, then run: §DATA a TYPE c LENGTH 3. a = \'ABCDE\'. WRITE a.§ and §DATA z TYPE n LENGTH 4. z = \'7\'. WRITE z.§', solution: 'Output ABC and 0007.' } },
    'd1.decl': { title: 'DATA, CONSTANTS, TYPES', reteach: `§DATA§ = a variable (has memory, can change).\n§CONSTANTS§ = a value that never changes; it **needs VALUE** and any assignment is a syntax error you see at once.\n§TYPES§ = only a shape. §TYPES ty_amt TYPE p LENGTH 8 DECIMALS 2.§ creates no variable. You then write §DATA gv_a TYPE ty_amt.§\n\nWhy TYPES at all? Change one line and every variable of that type changes with it.`, extra: { brief: 'Declare a type §ty_qty§ (p, length 6, 1 decimal), two variables of that type and a constant §gc_max§ = 100. Try assigning to the constant and read the error.', solution: '§TYPES ty_qty TYPE p LENGTH 6 DECIMALS 1. DATA: gv_a TYPE ty_qty, gv_b TYPE ty_qty. CONSTANTS gc_max TYPE i VALUE 100.§ Assigning §gc_max = 5.§ gives a syntax error on Check (Ctrl+F2).' } },
    'd1.struct': { title: 'Structures', reteach: `A structure is **one record** with named fields. Define the shape with §TYPES: BEGIN OF ty_emp, … END OF ty_emp.§ and create a variable §DATA gs_emp TYPE ty_emp.§\n\nRead and write a field with a dash: §gs_emp-name = 'Asha'.§ The dash, not a dot or arrow, separates structure and field.\n\n§CLEAR gs_emp.§ resets every field at once.`, extra: { brief: 'Create §ty_book§ with title (c 30), pages (i) and price (p 8,2). Fill one variable and print it, then CLEAR it and print again.', solution: 'After CLEAR: text blank, numbers 0.' } },
    'd1.inline': { title: 'Inline declarations', reteach: `§DATA(lv_n) = 10.§ declares §lv_n§ and fills it; the type comes from the **right-hand side**. 10 is an integer, so §lv_n§ is type i.\n\nTrap: §DATA(lv_t) = 'Hi'.§ gives a c of **length 2**. Assigning §'Hello'§ later keeps only §He§. When the text can grow, declare §DATA lv_s TYPE string.§ (or write the literal in backticks).`, extra: { brief: 'Write §DATA(a) = 5.§ and §DATA(b) = \'AB\'.§, and declare §DATA c TYPE string.§ with the value AB. Then assign \'ABCDEF\' to b and c and print both.', solution: 'b prints AB (c length 2), c prints ABCDEF (string).' } }
  },
  quiz: [
    Q('d1.types', 'What does this print?\n' + code("DATA gv TYPE c.\ngv = 'ABC'.\nWRITE gv."), 'A', ['ABC', 'AB', 'It does not compile'], 'TYPE c without LENGTH is exactly one character, so the text is cut to its first letter.'),
    Q('d1.types', 'What does this print?\n' + code("DATA zip TYPE n LENGTH 5.\nzip = '42'.\nWRITE zip."), '00042', ['42', '42   ', 'A runtime error'], 'Type n is digit-text padded with leading zeros up to its length.'),
    Q('d1.decl', 'Which line causes a syntax error?\n' + code("CONSTANTS gc_max TYPE i VALUE 10.\nDATA gv_n TYPE i.\n\ngv_n = gc_max.      \" line A\ngc_max = 20.        \" line B\ngv_n = gv_n + 1.    \" line C"), 'Line B', ['Line A', 'Line C', 'None of them'], 'A constant can be read but never assigned a new value.'),
    Q('d1.decl', 'What does §TYPES ty_amt TYPE p LENGTH 8 DECIMALS 2.§ do?', 'Describes a type; no variable is created', ['Creates a variable ty_amt', 'Creates a constant ty_amt', 'Reserves 8 bytes in memory'], 'TYPES only defines a shape. You need DATA to create something of that type.'),
    Q('d1.struct', 'Which statement correctly sets the name field of structure gs_emp?', 'gs_emp-name = \'Asha\'.', ['gs_emp.name = \'Asha\'.', 'gs_emp->name = \'Asha\'.', 'gs_emp:name = \'Asha\'.'], 'Fields of a structure are reached with a dash.'),
    Q('d1.inline', 'What is printed?\n' + code("DATA(lv) = 'Hi'.\nlv = 'Hello world'.\nWRITE lv."), 'He', ['Hi', 'Hello world', 'Hello'], 'The literal \'Hi\' makes lv a c of length 2, so the new text is cut to two characters.')
  ],
  retest: [
    Q('d1.types', 'What does this print?\n' + code("DATA a TYPE c LENGTH 3.\na = 'ABCDE'.\nWRITE a."), 'ABC', ['ABCDE', 'A', 'Syntax error'], 'The text is truncated to the declared length of 3.'),
    Q('d1.decl', 'Which statement declares a value that can never be changed?', 'CONSTANTS gc_rate TYPE i VALUE 5.', ['DATA gv_rate TYPE i VALUE 5.', 'TYPES ty_rate TYPE i.', 'DATA gv_rate TYPE i.'], 'CONSTANTS with VALUE is the fixed value; DATA stays changeable and TYPES creates no variable.'),
    Q('d1.struct', 'What is §gs_emp§ after §DATA gs_emp TYPE ty_emp.§ (ty_emp defined with BEGIN OF … END OF)?', 'One record holding all fields of ty_emp', ['A table of many records', 'A constant', 'A type definition'], 'A TYPE with BEGIN OF/END OF describes one row; DATA gives you one such row.'),
    Q('d1.inline', 'What is the type of lv_n?\n' + code("DATA(lv_n) = 10."), 'i (integer)', ['p', 'string', 'c with length 2'], 'The literal 10 is an integer, so the inline variable gets type i.')
  ],
  milestone: 'You can declare any basic variable, constant and structure without looking anything up.'
};
