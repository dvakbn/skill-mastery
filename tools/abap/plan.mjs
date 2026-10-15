// 30-day outline. Days with content are built in days/dN.mjs; the rest are designed and built phase by phase.
const P = [
  ['A', 'Foundations rebuild', 1, 5, 'Types, arithmetic, strings, loops and first internal tables'],
  ['B', 'Internal tables in depth', 6, 9, 'Reading, sorting, de-duplicating and field symbols'],
  ['C', 'Open SQL', 10, 15, 'Reading database tables correctly and efficiently'],
  ['D', 'Dictionary and modularisation', 16, 19, 'Dictionary objects, FORM routines and function modules'],
  ['E', 'Selection screens and ALV', 20, 23, 'User input, events and output'],
  ['F', 'OOP, errors and debugging', 24, 27, 'Classes, exceptions and the debugger'],
  ['G', 'Capstone and final', 28, 30, 'A full program, a weak-area retest and the final exam']
];
const D = [
  [1, 'Data types and declarations', 'c, n, i, p, string, CONSTANTS, TYPES vs DATA, structures, inline declarations'],
  [2, 'Operators and strings', 'Integer arithmetic, DIV/MOD, CONCATENATE, templates, CONDENSE, offsets, CS/CP'],
  [3, 'Control flow and loops', 'IF/CASE, DO/WHILE, sy-index, EXIT/CONTINUE/CHECK'],
  [4, 'Internal tables, part 1', 'Declare, APPEND, LOOP INTO, MODIFY, sy-tabix, lines( )'],
  [5, 'Checkpoint 1: foundations', 'Mixed test and a from-scratch program', true],
  [6, 'Reading tables', 'READ TABLE, sy-subrc, index and key reads, INSERT, COLLECT'],
  [7, 'Sorting and table kinds', 'SORT, DELETE ADJACENT DUPLICATES, BINARY SEARCH, standard/sorted/hashed'],
  [8, 'Field symbols and modern table syntax', 'ASSIGNING, inline declarations, table expressions, VALUE, FOR'],
  [9, 'Checkpoint 2: internal tables', 'Mixed test and a from-scratch program', true],
  [10, 'SELECT basics', 'SELECT SINGLE, UP TO n ROWS, WHERE, sy-subrc'],
  [11, 'Selecting into tables', 'INTO TABLE vs SELECT ... ENDSELECT, ORDER BY, field lists'],
  [12, 'Joins', 'INNER JOIN, LEFT OUTER JOIN, aliases'],
  [13, 'FOR ALL ENTRIES and aggregates', 'Empty driver table trap, COUNT, SUM, GROUP BY'],
  [14, 'Performance and new Open SQL', 'No SELECT in loops, @ escaping, inline results, CDS awareness'],
  [15, 'Checkpoint 3: Open SQL', 'Mixed test and a from-scratch program', true],
  [16, 'Data Dictionary in practice', 'Tables, data elements, domains, foreign keys, ST22 dumps'],
  [17, 'Subroutines (FORM)', 'FORM/PERFORM, USING/CHANGING, pass by value'],
  [18, 'Function modules', 'SE37, importing/exporting/tables, exceptions, calling'],
  [19, 'Checkpoint 4: modularisation', 'Mixed test and a from-scratch program', true],
  [20, 'Selection screens', 'PARAMETERS, SELECT-OPTIONS, ranges, IN'],
  [21, 'Events and messages', 'INITIALIZATION, AT SELECTION-SCREEN, START-OF-SELECTION, MESSAGE types'],
  [22, 'ALV output', 'CL_SALV_TABLE basics, columns, sorting'],
  [23, 'Checkpoint 5: reports', 'Mixed test and a from-scratch program', true],
  [24, 'Classes and methods', 'Definition vs implementation, instances, static methods'],
  [25, 'Visibility and constructors', 'PUBLIC/PROTECTED/PRIVATE, constructors, inheritance basics'],
  [26, 'Exceptions', 'TRY/CATCH, class-based and classic exceptions, message type X'],
  [27, 'Debugging and checkpoint 6', 'Breakpoints, watchpoints, ST22 and a mixed test', true],
  [28, 'Capstone build', 'A complete selection-screen + Open SQL + ALV report'],
  [29, 'Weak-area retest and buffer', 'Targeted retest from your own results; catch-up day'],
  [30, 'Final exam', 'Cumulative exam, mastery summary and next steps', true]
];
export const phases = P.map(([id, label, from, to, blurb]) => ({ id, label, from, to, blurb }));
export const plan = D.map(([n, title, topics, checkpoint]) => ({ n, phase: P.find(p => n >= p[2] && n <= p[3])[0], title, topics, checkpoint: !!checkpoint }));
