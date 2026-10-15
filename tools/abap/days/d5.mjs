import { code, Q } from '../dsl.mjs';
export default {
  n: 5, phase: 'A', title: 'Checkpoint 1: foundations', checkpoint: true, gate: 0.75,
  goal: 'Prove the foundations: types, arithmetic and strings, loops, and internal tables. Pass mark 75%.',
  objectives: ['Answer 12 mixed questions without looking anything up', 'Write a small program from a blank editor', 'Fix whatever the result shows is weak before Phase B'],
  minutes: { read: 8, examples: 0, exercise: 30, quiz: 12, review: 10 },
  read: `## How today works
Today is a **checkpoint**, not a new lesson. Phase B builds directly on Days 1–4, so anything shaky here would slow you down later.

1. **Skim** the four summaries below (8 minutes).
2. Write the **mini-program** from a blank editor (30 minutes). Look at hints only when stuck.
3. Take the **12-question test**. The pass mark is **75%** (9 of 12).
4. Anything you miss is reteaught and retested before Day 6 opens.

## Day 1 to 4 in one breath
- **Types:** §c§ is length 1 unless you say LENGTH; §n§ pads with zeros; §p§ holds decimals; TYPES describes, DATA allocates, CONSTANTS never changes; §DATA(x) = …§ takes its type from the right side.
- **Arithmetic and text:** into §i§ a division is **rounded**; §DIV§ cuts, §MOD§ is the remainder; strings: templates, CONDENSE, strlen, offset/length, CS.
- **Control flow:** §sy-index§ starts at 1; §EXIT§ leaves the innermost loop; §CONTINUE§ skips a pass; §CASE§ needs §WHEN OTHERS§.
- **Tables:** §LOOP AT … INTO§ **copies** the row; change the table with §MODIFY§; §sy-tabix§ is the row number; §lines( )§ counts rows.`,
  examples: [],
  exercise: {
    title: 'Stock report from a blank editor',
    brief: 'Build one program that uses types, a structure, a table, CASE, CONTINUE and a total. No copying from earlier days.',
    steps: ['Create **ZABAP_D5**.', 'Define **ty_item** (id i, name c15, cat c1, qty i, price p 8,2), a constant **gc_low = 10**, and a standard table.', 'Add five items (id, name, cat, qty, price): (1 Keyboard E 25 19.99), (2 Notebook S 0 3.50), (3 Mouse E 8 9.50), (4 Pen S 120 0.80), (5 Monitor E 6 149.00).', 'Loop over the table. **Skip items with qty 0** using CONTINUE. For every other item print name, a **category word** chosen with CASE (E = Electronics, S = Stationery, anything else = Other), qty and the stock value (qty x price).', 'Add the stock values into a **total** and count items whose qty is **below gc_low**.', 'Print the total and the low-stock count. Activate and run.'],
    expect: ['Four lines printed (Notebook is skipped)', 'Mouse **76.00**, Pen **96.00**, Keyboard **499.75**, Monitor **894.00**', 'Total **1,565.75**', 'Low-stock count **2** (Mouse and Monitor)'],
    hints: ['The value can be a p with 12 length and 2 decimals: §gv_val = gs_item-qty * gs_item-price.§', 'Put §IF gs_item-qty = 0. CONTINUE. ENDIF.§ first in the loop, before any printing or adding.', 'The category word: §CASE gs_item-cat. WHEN \'E\'. gv_cat = \'Electronics\'. WHEN \'S\'. gv_cat = \'Stationery\'. WHEN OTHERS. gv_cat = \'Other\'. ENDCASE.§'],
    solution: code("REPORT zabap_d5.\n\nTYPES: BEGIN OF ty_item,\n         id    TYPE i,\n         name  TYPE c LENGTH 15,\n         cat   TYPE c LENGTH 1,\n         qty   TYPE i,\n         price TYPE p LENGTH 8 DECIMALS 2,\n       END OF ty_item.\n\nCONSTANTS gc_low TYPE i VALUE 10.\n\nDATA: gt_item  TYPE STANDARD TABLE OF ty_item WITH EMPTY KEY,\n      gs_item  TYPE ty_item,\n      gv_val   TYPE p LENGTH 12 DECIMALS 2,\n      gv_total TYPE p LENGTH 12 DECIMALS 2,\n      gv_low   TYPE i,\n      gv_cat   TYPE string.\n\nAPPEND VALUE #( id = 1 name = 'Keyboard' cat = 'E' qty = 25  price = '19.99' ) TO gt_item.\nAPPEND VALUE #( id = 2 name = 'Notebook' cat = 'S' qty = 0   price = '3.50'  ) TO gt_item.\nAPPEND VALUE #( id = 3 name = 'Mouse'    cat = 'E' qty = 8   price = '9.50'  ) TO gt_item.\nAPPEND VALUE #( id = 4 name = 'Pen'      cat = 'S' qty = 120 price = '0.80'  ) TO gt_item.\nAPPEND VALUE #( id = 5 name = 'Monitor'  cat = 'E' qty = 6   price = '149.00' ) TO gt_item.\n\nLOOP AT gt_item INTO gs_item.\n  IF gs_item-qty = 0.\n    CONTINUE.\n  ENDIF.\n  CASE gs_item-cat.\n    WHEN 'E'. gv_cat = 'Electronics'.\n    WHEN 'S'. gv_cat = 'Stationery'.\n    WHEN OTHERS. gv_cat = 'Other'.\n  ENDCASE.\n  gv_val = gs_item-qty * gs_item-price.\n  gv_total = gv_total + gv_val.\n  IF gs_item-qty < gc_low.\n    gv_low = gv_low + 1.\n  ENDIF.\n  WRITE: / gs_item-name, gv_cat, gs_item-qty, gv_val.\nENDLOOP.\n\nWRITE: / 'Total:', gv_total.\nWRITE: / 'Low stock:', gv_low."),
    stretch: { brief: 'Raise every price by 5% with MODIFY, then print the new total stock value. Predict it before you run it.', solution: 'Multiply by 105 / 100 in the loop and MODIFY. Because rounding to 2 decimals happens per item, compare your prediction with the program output and explain any cent differences.' }
  },
  tags: {},
  quiz: [
    Q('d1.types', 'What is printed?\n' + code("DATA n TYPE n LENGTH 3.\nn = 12345.\nWRITE n."), '345', ['123', '12345', '000'], 'Numeric text keeps the rightmost digits when the value is too long, so only 345 fits.'),
    Q('d1.decl', 'You want to change the length of every amount field in a program in one place. What is the best design?', 'TYPES ty_amt once, then DATA ... TYPE ty_amt for each variable', ['Declare each field with its own LENGTH', 'Use CONSTANTS for each field', 'Use inline declarations only'], 'A shared TYPES is the single point of change for all variables built from it.'),
    Q('d1.inline', 'What is printed?\n' + code("DATA(lv_name) = 'Deepak'.\nlv_name = 'Deepak Raj'.\nWRITE lv_name."), 'Deepak', ['Deepak Raj', 'Deepak R', 'A runtime error'], 'The inline variable is a c of length 6 (the length of the literal), so the longer text is cut.'),
    Q('d2.intmath', 'What does gv_int contain?\n' + code("DATA gv_int TYPE i.\ngv_int = 5 / 2."), '3', ['2', '2.5', '5'], '2.5 is rounded up to 3 when stored in an integer.'),
    Q('d2.divmod', 'What does gv_r hold?\n' + code("DATA gv_r TYPE i.\ngv_r = 20 MOD 6."), '2', ['3', '6', '3.33'], '20 = 3 x 6 + 2, so the remainder is 2.'),
    Q('d2.offset', 'What is printed?\n' + code("DATA lv TYPE c LENGTH 14 VALUE 'ABAP Developer'.\nWRITE lv+5(3)."), 'Dev', ['ABA', 'Deve', 'AP D'], 'Offset 5 skips A, B, A, P and the space; length 3 takes D, e, v.'),
    Q('d3.exit', 'How many lines are written?\n' + code("DO 2 TIMES.\n  DO 4 TIMES.\n    IF sy-index = 3.\n      EXIT.\n    ENDIF.\n    WRITE: / sy-index.\n  ENDDO.\nENDDO."), '4', ['2', '3', '8'], 'EXIT stops only the inner loop at its third pass: 2 lines per outer pass, 2 outer passes.'),
    Q('d3.do', 'What does gv hold at the end?\n' + code("DATA gv TYPE i VALUE 10.\nDO 3 TIMES.\n  gv = gv + sy-index.\nENDDO."), '16', ['13', '19', '10'], 'sy-index runs 1, 2, 3: 10 + 1 + 2 + 3 = 16.'),
    Q('d3.ifcase', 'What is printed?\n' + code("DATA gv_c TYPE c LENGTH 1 VALUE 'B'.\nCASE gv_c.\n  WHEN 'A'. WRITE 1.\n  WHEN 'B'. WRITE 2.\n  WHEN 'C'. WRITE 3.\n  WHEN OTHERS. WRITE 4.\nENDCASE."), '2', ['2 and 3', '2 and 4', '4'], 'A CASE runs only the matching WHEN branch; it does not fall through.'),
    Q('d4.loopcopy', 'The first row of gt has qty 7. What is it afterwards?\n' + code("LOOP AT gt INTO gs.\n  gs-qty = 0.\n  MODIFY gt FROM gs.\nENDLOOP."), '0', ['7', 'The row is deleted', 'A runtime error'], 'MODIFY writes the changed work area back to the current row.'),
    Q('d4.tabix', 'What is sy-subrc after a LOOP that processed at least one row?', '0', ['4', '8', 'It is unchanged'], 'sy-subrc is 0 if the loop body ran at least once.'),
    Q('d4.modify', 'What does lines( gt ) return?\n' + code("\" gt has 3 rows\nDELETE gt INDEX 1."), '2', ['3', '1', '0'], 'One row was removed from three, so two remain.')
  ],
  retest: [
    Q('d1.types', 'What is printed?\n' + code("DATA x TYPE c LENGTH 2.\nx = 'XYZ'.\nWRITE x."), 'XY', ['XYZ', 'X', 'ZY'], 'Text is cut to the declared length of 2.'),
    Q('d1.decl', 'Which statement creates a variable that can change?', 'DATA gv_n TYPE i.', ['CONSTANTS gc_n TYPE i VALUE 1.', 'TYPES ty_n TYPE i.', 'WRITE gv_n.'], 'Only DATA creates a variable whose value can change; CONSTANTS is fixed and TYPES is just a shape.'),
    Q('d2.intmath', 'Which target gives 3.50 for §7 / 2§?', 'A p variable with 2 decimals', ['An i variable', 'A c of length 4 only', 'A d variable'], 'Only a p with DECIMALS can hold a fraction.'),
    Q('d2.strings', 'Which statement removes extra spaces from lv?', 'CONDENSE lv.', ['TRIM lv.', 'SHIFT lv.', 'CLEAR lv.'], 'CONDENSE trims the ends and reduces inner space runs to one.'),
    Q('d3.exit', 'Which statement leaves only the innermost loop?', 'EXIT.', ['CONTINUE.', 'CHECK.', 'RETURN. in every case'], 'EXIT ends the loop it is directly in.'),
    Q('d4.loopcopy', 'Why do we write §MODIFY gt FROM gs.§ in a LOOP … INTO?', 'Because gs is only a copy of the table row', ['Because loops are read-only', 'To delete the row', 'To reset sy-tabix'], 'The work area is a copy; MODIFY is what updates the real row.')
  ],
  milestone: 'Milestone 1: you can write a table-driven report from a blank editor and trace its output by hand.'
};
