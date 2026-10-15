import { code, Q } from '../dsl.mjs';
export default {
  n: 4, phase: 'A', title: 'Internal tables, part 1',
  goal: 'Create an internal table, fill it, loop over it, change rows safely and count them.',
  objectives: ['Declare a standard internal table from a structure type', 'Fill it with APPEND', 'Explain that LOOP AT … INTO copies each row', 'Change rows with MODIFY', 'Use sy-tabix and lines( )'],
  minutes: { read: 15, examples: 10, exercise: 20, quiz: 8, review: 7 },
  read: `## What an internal table is
An **internal table** is a list of rows held in memory while the program runs. Every row has the same structure. It is ABAP's main working container: you read database rows into one, process it, then show it.

## Declaring one
First a row type, then the table:
§TYPES: BEGIN OF ty_emp, … END OF ty_emp.§
§DATA gt_emp TYPE STANDARD TABLE OF ty_emp WITH EMPTY KEY.§
§DATA gs_emp TYPE ty_emp.§  ← the **work area**: one row you hold in your hand.

## Filling
- §APPEND gs_emp TO gt_emp.§ adds the work area as a new last row.
- §APPEND VALUE #( id = 2 name = 'Ravi' ) TO gt_emp.§ builds the row in place (modern, shorter).

## Reading rows with a loop
§LOOP AT gt_emp INTO gs_emp. … ENDLOOP.§ visits each row in order. **INTO copies the row into the work area.** So:
- you can read the work area freely;
- changing §gs_emp-salary§ inside the loop does **not** change the table. Write it back with §MODIFY gt_emp FROM gs_emp.§ (inside the loop this updates the current row).

Inside a loop §sy-tabix§ is the current row number (starting at 1). §sy-subrc§ is 4 after the loop if the table had no rows to visit.

## Counting and clearing
§lines( gt_emp )§ returns the row count. §CLEAR gt_emp.§ empties the table. §DELETE gt_emp INDEX 2.§ removes row 2. §WHERE§ filters: §LOOP AT gt_emp INTO gs_emp WHERE salary > 50000.§

## Habits
Name tables §gt_/lt_§ and work areas §gs_/ls_§. Header lines (a table with a built-in work area) are obsolete; do not use them.`,
  examples: [
    { title: 'Declare and fill', code: code("TYPES: BEGIN OF ty_emp,\n         id     TYPE i,\n         name   TYPE c LENGTH 15,\n         salary TYPE p LENGTH 8 DECIMALS 2,\n       END OF ty_emp.\n\nDATA gt_emp TYPE STANDARD TABLE OF ty_emp WITH EMPTY KEY.\nDATA gs_emp TYPE ty_emp.\n\ngs_emp-id = 1. gs_emp-name = 'Asha'. gs_emp-salary = 42000.\nAPPEND gs_emp TO gt_emp.\n\nAPPEND VALUE #( id = 2 name = 'Ravi' salary = 55000 ) TO gt_emp."), notes: 'The same table now holds two rows.' },
    { title: 'LOOP … INTO copies the row', code: code("LOOP AT gt_emp INTO gs_emp.\n  gs_emp-salary = gs_emp-salary + 1000.   \" changes only the copy\nENDLOOP.\n\" gt_emp is unchanged here!"), notes: 'This is the exact point the diagnostic caught: the work area is a copy.' },
    { title: 'MODIFY writes the copy back', code: code("LOOP AT gt_emp INTO gs_emp.\n  gs_emp-salary = gs_emp-salary + 1000.\n  MODIFY gt_emp FROM gs_emp.             \" updates the current row\nENDLOOP."), notes: 'Day 8 shows field symbols, which edit the row directly without copying.' },
    { title: 'sy-tabix, lines and WHERE', code: code("LOOP AT gt_emp INTO gs_emp WHERE salary > 50000.\n  WRITE: / sy-tabix, gs_emp-name.\nENDLOOP.\nWRITE: / 'Rows:', lines( gt_emp )."), notes: 'sy-tabix is the row number in the full table, even when WHERE skips some rows.' }
  ],
  exercise: {
    title: 'Employee table',
    brief: 'Build a five-row table, report on it, then give everyone a raise the right way.',
    steps: ['Create **ZABAP_D4**.', 'Define **ty_emp** (id i, name c15, salary p 8,2) and a standard table **gt_emp**.', 'Add five employees: Asha 42000, Ravi 55000, Meena 61000, Imran 38000, Sara 70000.', 'Loop and print row number, name and salary. In the same loop add up the **total salary** and count employees earning **above 50000**.', 'Print the total, the count and the number of rows with **lines( )**.', 'Second loop: raise every salary by **10%** and write it back with **MODIFY**. Loop again and print the new salaries.'],
    expect: ['Rows 1 to 5 with names and salaries', 'Total **266,000.00**, above 50000: **3**, rows: **5**', 'After the raise: Asha 46,200 · Ravi 60,500 · Meena 67,100 · Imran 41,800 · Sara 77,000'],
    hints: ['Use §APPEND VALUE #( id = 2 name = \'Ravi\' salary = 55000 ) TO gt_emp.§ for each row.', 'A raise of 10% is §gs_emp-salary = gs_emp-salary * 11 / 10.§', 'If the second listing shows the old salaries, you forgot §MODIFY gt_emp FROM gs_emp.§'],
    solution: code("REPORT zabap_d4.\n\nTYPES: BEGIN OF ty_emp,\n         id     TYPE i,\n         name   TYPE c LENGTH 15,\n         salary TYPE p LENGTH 8 DECIMALS 2,\n       END OF ty_emp.\n\nDATA: gt_emp   TYPE STANDARD TABLE OF ty_emp WITH EMPTY KEY,\n      gs_emp   TYPE ty_emp,\n      gv_total TYPE p LENGTH 8 DECIMALS 2,\n      gv_high  TYPE i.\n\nAPPEND VALUE #( id = 1 name = 'Asha'  salary = 42000 ) TO gt_emp.\nAPPEND VALUE #( id = 2 name = 'Ravi'  salary = 55000 ) TO gt_emp.\nAPPEND VALUE #( id = 3 name = 'Meena' salary = 61000 ) TO gt_emp.\nAPPEND VALUE #( id = 4 name = 'Imran' salary = 38000 ) TO gt_emp.\nAPPEND VALUE #( id = 5 name = 'Sara'  salary = 70000 ) TO gt_emp.\n\nLOOP AT gt_emp INTO gs_emp.\n  WRITE: / sy-tabix, gs_emp-name, gs_emp-salary.\n  gv_total = gv_total + gs_emp-salary.\n  IF gs_emp-salary > 50000.\n    gv_high = gv_high + 1.\n  ENDIF.\nENDLOOP.\nWRITE: / 'Total:', gv_total, 'Above 50000:', gv_high, 'Rows:', lines( gt_emp ).\n\nLOOP AT gt_emp INTO gs_emp.\n  gs_emp-salary = gs_emp-salary * 11 / 10.\n  MODIFY gt_emp FROM gs_emp.\nENDLOOP.\n\nSKIP.\nLOOP AT gt_emp INTO gs_emp.\n  WRITE: / gs_emp-name, gs_emp-salary.\nENDLOOP."),
    stretch: { brief: 'Delete the lowest-paid employee with §DELETE gt_emp INDEX n.§ after finding which row it is in a loop (remember sy-tabix). Then print the remaining count.', solution: 'Track the minimum in a loop, store its §sy-tabix§, leave the loop, then §DELETE gt_emp INDEX lv_idx.§ Imran (row 4) is deleted; lines( ) is then 4.' }
  },
  tags: {
    'd4.declare': { title: 'Declaring and filling a table', reteach: `A table needs a **row type** (a structure) first: §TYPES: BEGIN OF ty_emp … END OF ty_emp.§ Then §DATA gt_emp TYPE STANDARD TABLE OF ty_emp WITH EMPTY KEY.§\n\nThe **work area** §DATA gs_emp TYPE ty_emp.§ is the single row you read or build. §APPEND gs_emp TO gt_emp.§ adds it as the last row; §APPEND VALUE #( … ) TO gt_emp.§ builds and adds in one statement.\n\nThe table and the work area are two different things: the work area is **not** a row of the table.`, extra: { brief: 'Define ty_city (name c20, population i). Build a table with three cities, then print lines( ).', solution: 'Declare ty_city and §gt_city§, append three rows with VALUE #( … ), then §WRITE lines( gt_city ).§ prints 3.' } },
    'd4.loopcopy': { title: 'LOOP AT … INTO copies the row', reteach: `§LOOP AT gt INTO gs.§ **copies** each row into §gs§. The table row and the work area are separate memory.\n\nSo §gs-salary = gs-salary + 1000.§ inside the loop changes only the copy. When the loop ends the table is exactly as before.\n\nTo persist the change: §MODIFY gt FROM gs.§ (current row). The other way is a field symbol, which points at the real row (Day 8).`, extra: { brief: 'Loop over a 3-row table adding 5 to a number field without MODIFY, print the table, then add MODIFY and print again.', solution: 'First print shows unchanged values; with MODIFY the values are +5.' } },
    'd4.modify': { title: 'MODIFY and DELETE rows', reteach: `§MODIFY gt FROM gs.§ inside a §LOOP AT gt INTO gs§ overwrites the **current** row with the work area.\nOutside a loop give the row: §MODIFY gt FROM gs INDEX 3.§\n§DELETE gt INDEX 2.§ removes row 2; rows below move up by one, so row numbers change.\n\nNever delete from a table inside a loop over it unless you understand the index shift; collect first, then delete (or use §DELETE gt WHERE …§).`, extra: { brief: 'Remove all rows with salary below 40000 using §DELETE gt_emp WHERE salary < 40000.§ and print what is left.', solution: 'Imran (38000) is removed; four rows remain.' } },
    'd4.tabix': { title: 'sy-tabix, lines( ) and sy-subrc', reteach: `§sy-tabix§ = row number inside a table loop (1, 2, 3 …), even when §WHERE§ skips rows.\n§lines( gt )§ = how many rows the table has right now.\nAfter §LOOP … ENDLOOP.§ the §sy-subrc§ is 0 if at least one row was processed and **4** if none was.\n\n§sy-index§ is for DO/WHILE; §sy-tabix§ is for table loops. Do not mix them up.`, extra: { brief: 'Print §sy-tabix§ for each row where salary > 50000 in the 5-row table, and the value of sy-subrc after the loop on an empty table.', solution: 'Rows 2, 3, 5 print (the real positions); on an empty table sy-subrc is 4.' } }
  },
  quiz: [
    Q('d4.loopcopy', 'After this code, what is the salary of the first row in gt_emp (it was 1000)?\n' + code("LOOP AT gt_emp INTO gs_emp.\n  gs_emp-salary = gs_emp-salary + 500.\nENDLOOP."), '1000 (unchanged)', ['1500', '500', 'A runtime error'], 'INTO copies the row into the work area. Changing the copy does not touch the table.'),
    Q('d4.loopcopy', 'Which addition makes the change persist?', 'MODIFY gt_emp FROM gs_emp. inside the loop', ['COMMIT WORK. after the loop', 'APPEND gs_emp TO gt_emp. inside the loop', 'CLEAR gs_emp. before the loop'], 'MODIFY writes the work area back to the current row. APPEND would add a duplicate row.'),
    Q('d4.declare', 'What is §gs_emp§ in §DATA gs_emp TYPE ty_emp.§?', 'A work area that holds a single row', ['A table with many rows', 'A pointer to the first row', 'A constant'], 'The work area is a single-row structure used to move one row at a time.'),
    Q('d4.tabix', 'What does §lines( gt_emp )§ return?', 'The number of rows in the table', ['The number of columns', 'The index of the last row only if the table is sorted', 'The size in bytes'], 'lines( ) counts the rows currently in the table.'),
    Q('d4.tabix', 'Inside §LOOP AT gt_emp INTO gs_emp WHERE salary > 50000.§ the matching rows are 2, 3 and 5. What is sy-tabix on the third match?', '5', ['3', '1', '0'], 'sy-tabix is the row number in the table, so the third matching row has tabix 5.'),
    Q('d4.modify', 'What happens to the row numbers after §DELETE gt_emp INDEX 2.§ on a 4-row table?', 'Former rows 3 and 4 become rows 2 and 3', ['They stay the same and row 2 is empty', 'The table is cleared', 'Row 1 moves to the end'], 'Rows below the deleted one move up by one, so the table stays contiguous.')
  ],
  retest: [
    Q('d4.declare', 'Which statement adds a new last row to gt_emp using the work area gs_emp?', 'APPEND gs_emp TO gt_emp.', ['INSERT gt_emp INTO gs_emp.', 'ADD gs_emp TO gt_emp.', 'gt_emp = gs_emp.'], 'APPEND ... TO appends a work area as the last row.'),
    Q('d4.loopcopy', 'Why can §gs_emp-salary = gs_emp-salary * 2.§ in a LOOP … INTO leave the table unchanged?', 'gs_emp is a copy of the row', ['The table is read-only', 'sy-subrc is 4', 'gs_emp is a constant'], 'The loop copies each row into the work area, so only the copy is changed.'),
    Q('d4.modify', 'Which statement removes every row with a salary under 40000?', 'DELETE gt_emp WHERE salary < 40000.', ['CLEAR gt_emp WHERE salary < 40000.', 'DELETE gt_emp INDEX salary < 40000.', 'REMOVE gt_emp WHERE salary < 40000.'], 'DELETE itab WHERE deletes all matching rows in one statement.'),
    Q('d4.tabix', 'What is sy-subrc after a LOOP over an empty table?', '4', ['0', '1', '8'], 'If no row is processed, the loop ends with sy-subrc = 4.')
  ],
  milestone: 'You can build a table from scratch, loop it, total it and update it correctly.'
};
