// SAP ABAP diagnostic bank -> app/data/abap-diagnostic.json
// Run: node tools/abap/diagnostic.mjs   (validates, shuffles option order deterministically, writes the JSON)
import fs from 'node:fs';
const out = new URL('../../app/data/abap-diagnostic.json', import.meta.url).pathname;

const topics = [
  { id: 'basics', label: 'Data declarations and types', blurb: 'DATA, TYPES, CONSTANTS, inline declarations, type c, structures.' },
  { id: 'control', label: 'Control flow, operators and strings', blurb: 'IF, CASE, DO, loops, arithmetic, string handling.' },
  { id: 'itab', label: 'Internal tables', blurb: 'Table kinds, APPEND, LOOP, READ TABLE, SORT, field symbols.' },
  { id: 'sql', label: 'Open SQL and database access', blurb: 'SELECT, joins, FOR ALL ENTRIES, sy-subrc, performance, modern syntax.' },
  { id: 'dict', label: 'Data Dictionary and SAP tools', blurb: 'SE11, SE16, SE38, ST22, domains, data elements, foreign keys.' },
  { id: 'modular', label: 'Modularisation', blurb: 'FORM, function modules, methods, includes, parameter passing.' },
  { id: 'screen', label: 'Selection screens, events and output', blurb: 'PARAMETERS, SELECT-OPTIONS, report events, ALV.' },
  { id: 'oop', label: 'OOP, errors and debugging', blurb: 'Classes, visibility, exceptions, messages, the debugger.' },
];

// q(topic, level, tag, prompt, options, answerIndex, why, fixed?)  fixed=true keeps option order (numbers, A/B outputs)
const Q = [];
const q = (topic, level, tag, prompt, options, answer, why, fixed = false) => Q.push({ topic, level, tag, prompt, options, answer, why, fixed });

// ---- basics
q('basics', 1, 'DATA declaration', 'Which statement correctly declares an integer variable?', ['DATA lv_count TYPE i.', 'DATA lv_count AS integer.', 'INT lv_count.', 'VAR lv_count TYPE i.'], 0, 'The form is DATA name TYPE type. Type i is the built-in 4-byte integer.');
q('basics', 1, 'Type c length', 'What is displayed by this program?\n\n```\nDATA lv_code TYPE c LENGTH 5.\nlv_code = \'ABCDEFGH\'.\nWRITE lv_code.\n```', ['ABCDEFGH', 'ABCDE', 'A short dump occurs', 'Nothing, the field stays empty'], 1, 'A fixed-length type c field cuts the value on the right when the source is longer. There is no error and no warning at runtime.');
q('basics', 2, 'CONSTANTS', 'What happens with this code?\n\n```\nCONSTANTS gc_max TYPE i VALUE 10.\ngc_max = 20.\n```', ['The value changes to 20', 'A syntax error is reported when the program is checked', 'A short dump occurs at runtime', 'The assignment is silently ignored'], 1, 'A constant cannot be changed. The compiler detects this at syntax check time, so the program cannot even be activated.');
q('basics', 2, 'TYPES versus DATA', 'What is the difference between TYPES and DATA?', ['They are identical', 'TYPES defines a data type and reserves no memory; DATA creates a variable of a type', 'TYPES creates a global variable and DATA a local one', 'DATA can only be used for internal tables'], 1, 'TYPES describes a structure or type only. DATA creates an actual variable (memory) based on a type.');
q('basics', 3, 'Inline declaration', 'What does this statement do (ABAP 7.40 and later)?\n\n```\nDATA(lv_sum) = lv_a + lv_b.\n```', ['It is a syntax error because DATA needs a TYPE', 'It declares lv_sum on the spot, with the type derived from the right-hand side', 'It always declares lv_sum as type string', 'It only works inside classes'], 1, 'Inline declarations create the variable where it is first used. The type comes from the expression, for example i if lv_a and lv_b are integers.');

// ---- control
q('control', 1, 'IF / ELSEIF', 'What is displayed?\n\n```\nDATA lv_n TYPE i VALUE 15.\nIF lv_n > 20.\n  WRITE \'A\'.\nELSEIF lv_n > 10.\n  WRITE \'B\'.\nELSE.\n  WRITE \'C\'.\nENDIF.\n```', ['A', 'B', 'C', 'A and B'], 1, '15 is not above 20, but it is above 10, so the ELSEIF branch runs and only B is written. Only one branch of an IF chain runs.', true);
q('control', 1, 'DO and sy-index', 'Which values of sy-index are written?\n\n```\nDO 3 TIMES.\n  WRITE sy-index.\nENDDO.\n```', ['0, 1, 2', '1, 2, 3', '3, 3, 3', 'None: sy-index only works with WHILE'], 1, 'sy-index counts loop passes starting at 1 in DO and WHILE loops.', true);
q('control', 2, 'EXIT in loops', 'Inside a loop, which statement leaves the loop completely?', ['CONTINUE', 'EXIT', 'CHECK', 'SKIP'], 1, 'EXIT ends the loop. CONTINUE and a failing CHECK only skip the rest of the current pass. SKIP is an output statement for lists.');
q('control', 2, 'CONDENSE', 'What does lv_t contain after CONDENSE?\n\n```\nDATA lv_t TYPE c LENGTH 30.\nlv_t = \'  Hello    World\'.\nCONDENSE lv_t.\n```', ['Hello World', 'Hello    World (only the leading blanks are removed)', 'HelloWorld', 'Unchanged'], 0, 'CONDENSE removes leading blanks and reduces every gap between words to a single blank. NO-GAPS would remove the gaps entirely.', true);
q('control', 3, 'Integer arithmetic', 'What is displayed?\n\n```\nDATA lv_r TYPE i.\nlv_r = 7 / 2.\nWRITE lv_r.\n```', ['3', '4', '3.5', 'A syntax error'], 1, '7 / 2 is 3.5 and ABAP rounds commercially when the result goes into type i, so you get 4. Use 7 DIV 2 for integer division (3) and 7 MOD 2 for the remainder (1).', true);

// ---- itab
q('itab', 1, 'APPEND', 'Which statement adds the work area ls_emp as the last line of internal table lt_emp?', ['ADD ls_emp TO lt_emp.', 'APPEND ls_emp TO lt_emp.', 'PUSH ls_emp ONTO lt_emp.', 'lt_emp = lt_emp + ls_emp.'], 1, 'APPEND wa TO itab adds at the end. INSERT can add at a chosen position or key position.');
q('itab', 1, 'LOOP AT INTO', 'In each pass of LOOP AT lt_emp INTO ls_emp, what does ls_emp contain?', ['A reference to the current row', 'A copy of the current row', 'The whole table', 'Only the key fields'], 1, 'INTO copies the row into the work area. Changing ls_emp does not change the table unless you use MODIFY. A field symbol (ASSIGNING) gives direct access.');
q('itab', 2, 'READ TABLE sy-subrc', 'READ TABLE lt_emp INTO ls_emp WITH KEY id = 5. finds no row. What is sy-subrc?', ['0', '4', '8', '-1'], 1, 'sy-subrc is 0 when a row is found and 4 when it is not. Always check it before using the work area.', true);
q('itab', 2, 'DELETE ADJACENT DUPLICATES', 'Why is the table normally sorted before DELETE ADJACENT DUPLICATES?', ['The statement only removes duplicates that are next to each other, so equal rows must be neighbours', 'Without SORT the statement raises a short dump', 'SORT frees memory', 'There is no reason; SORT has no effect here'], 0, 'The statement compares only a row with its direct neighbour. SORT BY the compared fields puts duplicates together first.');
q('itab', 3, 'Field symbols', 'What is the main advantage of LOOP AT lt_emp ASSIGNING <fs_emp> over INTO ls_emp?', ['It is the only way to read rows', 'No copy of the row is made, and changes through <fs_emp> change the table row directly', 'It sorts the table', 'It makes the loop run backwards'], 1, 'A field symbol points at the row in the table. This avoids copying and lets you modify in place without MODIFY.');
q('itab', 3, 'BINARY SEARCH', 'What must be true for READ TABLE lt_emp INTO ls_emp WITH KEY id = 5 BINARY SEARCH. to work correctly on a standard table?', ['The table is sorted ascending by id', 'The table is a hashed table', 'The table has a header line', 'Nothing special is needed'], 0, 'Binary search assumes the table is sorted by the search key. On an unsorted standard table it can miss an existing row and return sy-subrc 4.');

// ---- sql
q('sql', 1, 'UP TO n ROWS', 'What does UP TO 5 ROWS do?\n\n```\nSELECT * FROM scarr INTO TABLE lt_scarr UP TO 5 ROWS.\n```', ['Reads at most 5 rows', 'Reads exactly 5 rows or raises an error', 'Skips the first 5 rows', 'Reads only 5 columns'], 0, 'UP TO n ROWS limits the result to n rows. If fewer exist you simply get fewer.');
q('sql', 1, 'SELECT SINGLE sy-subrc', 'After a successful SELECT SINGLE, what is sy-subrc?', ['0', '4', '8', 'It is unchanged'], 0, 'sy-subrc is 0 when a row was found and 4 when nothing matched.', true);
q('sql', 2, 'INTO TABLE versus ENDSELECT', 'To read thousands of rows into an internal table, which is generally better?', ['SELECT ... ENDSELECT with APPEND inside the loop', 'SELECT ... INTO TABLE lt_data (one array fetch)', 'A SELECT SINGLE inside a loop', 'They always perform the same'], 1, 'INTO TABLE fetches the rows in packages in one statement. A SELECT loop or repeated SELECT SINGLE is slower and wastes round trips.');
q('sql', 2, 'INNER JOIN', 'An INNER JOIN of tables A and B returns:', ['All rows of A, with empty B fields where there is no match', 'Only rows that have a matching partner in both tables', 'All rows of both tables', 'Only rows that have no match'], 1, 'INNER JOIN keeps only matches. A LEFT OUTER JOIN keeps all rows of the left table.');
q('sql', 2, 'SELECT inside LOOP', 'Which is the classic database performance mistake?', ['One SELECT with a WHERE clause and INTO TABLE', 'A SELECT SINGLE inside a LOOP, causing one database call per row', 'Selecting only the fields you need', 'Using key fields in the WHERE clause'], 1, 'Many small database calls are slow. Read everything needed once (join or FOR ALL ENTRIES) and process in memory.');
q('sql', 3, 'FOR ALL ENTRIES and empty tables', 'What is the danger when the driver table of FOR ALL ENTRIES is empty?', ['No rows are returned and sy-subrc is 4', 'The condition using the driver table is effectively dropped, so far more rows than intended can be read; check that the table is not empty first', 'It causes a syntax error', 'It always causes a short dump'], 1, 'With an empty driver table the restriction does not behave as you expect and the selection can return far too much. Always guard with IF lt_driver IS NOT INITIAL. (Also note FOR ALL ENTRIES removes duplicate result rows.)');
q('sql', 3, 'New Open SQL syntax', 'What is the @ sign for?\n\n```\nSELECT carrid, connid FROM spfli\n  INTO TABLE @DATA(lt_flights)\n  WHERE carrid = @lv_carrid.\n```', ['It marks ABAP host variables in the new Open SQL syntax', 'It starts a comment', 'It concatenates strings', 'It begins a native SQL block'], 0, 'In the newer syntax (7.40 SP05+) host variables are escaped with @ and the field list is separated by commas.');

// ---- dict
q('dict', 1, 'SE38', 'Which transaction is the standard editor for creating and changing a report program?', ['SE11', 'SE38', 'SE16', 'ST22'], 1, 'SE38 is the ABAP Editor. SE80 (Object Navigator) also works. SE11 is the Dictionary, SE16 shows table data and ST22 shows short dumps.');
q('dict', 1, 'SE16', 'Which transaction displays the contents of a database table?', ['SE16', 'SE38', 'SE37', 'SE93'], 0, 'SE16 (Data Browser) shows table entries. SE16N is a newer variant.');
q('dict', 2, 'Domain versus data element', 'Where are field labels (short, medium, long text) and F1 documentation maintained?', ['In the domain', 'In the data element', 'In the table type', 'In the search help'], 1, 'A domain holds technical attributes (type, length). A data element gives it meaning: labels and documentation. A table field refers to a data element.');
q('dict', 2, 'ST22', 'Which transaction shows ABAP runtime errors (short dumps)?', ['SE24', 'ST22', 'SM30', 'SE93'], 1, 'ST22 lists short dumps with the error text, the source line and the variable values at the time.');
q('dict', 3, 'Foreign keys', 'A foreign key defined for a field of a transparent table in SE11 mainly provides:', ['A database constraint that automatically blocks any invalid INSERT from ABAP code', 'Value checks for dialog input and input help; it does not check INSERT statements made in ABAP code', 'Automatic archiving', 'Faster SELECT statements'], 1, 'DDIC foreign keys drive input checks on screens and input help. They are not enforced automatically on database writes from ABAP; you must check in code.');

// ---- modular
q('modular', 1, 'Function modules', 'Which modularisation unit is stored in a function group and can be called from other programs (and remotely if RFC-enabled)?', ['Include program', 'Subroutine (FORM)', 'Function module', 'Macro'], 2, 'Function modules are central, reusable and have a defined interface. Includes only split source code and FORMs are local to a program.');
q('modular', 2, 'FORM parameters', 'What is lv_r after the call?\n\n```\nPERFORM add USING 2 3 CHANGING lv_r.\n\nFORM add USING p_a TYPE i p_b TYPE i\n         CHANGING p_r TYPE i.\n  p_r = p_a + p_b.\nENDFORM.\n```', ['0', '5', '23', 'A syntax error, because USING takes only variables'], 1, 'USING passes the inputs (literals are allowed), CHANGING passes the result back, so lv_r is 5.', true);
q('modular', 2, 'Pass by value', 'In a subroutine, what does USING VALUE(p_x) mean?', ['p_x is passed by value: changes inside the subroutine do not affect the caller\'s variable', 'p_x is a constant', 'p_x is read from the database', 'p_x can only hold strings'], 0, 'Pass by value works on a copy. By reference (the default) works on the caller\'s variable.');
q('modular', 2, 'Static method call', 'Which syntax calls the static method get_date of class lcl_util?', ['lcl_util=>get_date( )', 'lcl_util->get_date( )', 'lcl_util.get_date( )', 'CALL lcl_util get_date.'], 0, 'Static methods use the class name and =>. Instance methods use an object reference and ->.');
q('modular', 3, 'Classic exceptions', 'After CALL FUNCTION ... EXCEPTIONS not_found = 1 OTHERS = 2, how do you know an exception was raised?', ['sy-subrc is not 0 (it holds the number assigned to the exception)', 'sy-index is set', 'The program always terminates', 'A message appears automatically'], 0, 'Classic function module exceptions set sy-subrc to the number you assigned. Check it directly after the call.');

// ---- screen
q('screen', 1, 'SELECT-OPTIONS', 'Which statement creates a from-to range input on the selection screen?', ['PARAMETERS', 'SELECT-OPTIONS', 'RANGE-INPUT', 'PARAMETER RANGE'], 1, 'PARAMETERS gives a single value. SELECT-OPTIONS gives a selection table with SIGN, OPTION, LOW and HIGH.');
q('screen', 1, 'START-OF-SELECTION', 'In an executable report, where does the main processing normally start after the selection screen?', ['INITIALIZATION', 'START-OF-SELECTION', 'LOAD-OF-PROGRAM', 'TOP-OF-PAGE'], 1, 'START-OF-SELECTION runs after the user executes the selection screen. INITIALIZATION runs before the screen is shown.');
q('screen', 2, 'IN with a selection table', 'Given SELECT-OPTIONS s_carr FOR spfli-carrid., how do you use it in a SELECT?', ['WHERE carrid IN s_carr', 'WHERE carrid = s_carr', 'WHERE carrid BETWEEN s_carr', 'WHERE s_carr CONTAINS carrid'], 0, 'A selection table is used with IN. It handles single values, ranges, patterns and exclusions at once.');
q('screen', 2, 'AT SELECTION-SCREEN', 'Which event is the standard place to validate selection screen input and show an error?', ['AT SELECTION-SCREEN', 'END-OF-SELECTION', 'TOP-OF-PAGE', 'INITIALIZATION'], 0, 'AT SELECTION-SCREEN (or ON field) runs after input, so an error message there keeps the user on the screen.');
q('screen', 3, 'ALV with CL_SALV_TABLE', 'Which class gives the quickest way to show an internal table as an ALV grid in modern ABAP?', ['CL_SALV_TABLE', 'CL_ABAP_TYPEDESCR', 'CL_BCS', 'CL_GUI_FRONTEND_SERVICES'], 0, 'cl_salv_table=>factory( ... ) followed by display( ) shows the table as an ALV with sorting and filtering built in.');

// ---- oop
q('oop', 1, 'Class parts', 'An ABAP class consists of which two parts?', ['Header and footer', 'Definition and implementation', 'Interface and include', 'Public and private programs'], 1, 'CLASS ... DEFINITION declares components; CLASS ... IMPLEMENTATION contains the method code.');
q('oop', 1, 'BREAK-POINT', 'Which statement hard-codes a stop at that line in the debugger?', ['BREAK-POINT.', 'STOP-HERE.', 'DEBUG.', 'HALT.'], 0, 'BREAK-POINT stops execution in the debugger. Use it only while developing and remove it before transport. A session breakpoint in the editor margin is cleaner.');
q('oop', 2, 'Visibility', 'An attribute declared in the PRIVATE SECTION can be accessed from:', ['Any program', 'Only inside the class itself', 'The class and its subclasses', 'Only function modules'], 1, 'Private components are visible only within the class. Protected adds subclasses; public is visible to everyone.');
q('oop', 2, 'Catching exceptions', 'Which exception class is raised by a division by zero at runtime and can be caught with TRY ... CATCH?', ['CX_SY_ZERODIVIDE', 'CX_SY_OPEN_SQL_DB', 'CX_NO_ZERO', 'CX_DYNAMIC_CHECK'], 0, 'CX_SY_ZERODIVIDE is raised by the runtime and is catchable, so you can handle the error instead of a short dump.');
q('oop', 3, 'Message type X', 'Which message type deliberately ends the program with a short dump?', ['S', 'I', 'A', 'X'], 3, 'Type X raises the runtime error MESSAGE_TYPE_X. Type A ends the transaction with an abend message; S, I and E are normal messages.', true);

// ---------- validate + shuffle
const errs = []; const seen = new Set(); let n = 0;
const words = s => s.trim().split(/\s+/).length;
function rng(seed) { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
const out_q = Q.map(x => {
  const id = `abap.d${++n}`; if (seen.has(id)) errs.push('dup ' + id); seen.add(id);
  if (!topics.some(t => t.id === x.topic)) errs.push(id + ' topic');
  if (![1, 2, 3].includes(x.level)) errs.push(id + ' level');
  if (x.options.length !== 4 || new Set(x.options).size !== 4) errs.push(id + ' needs 4 distinct options');
  if (!(x.answer >= 0 && x.answer < 4)) errs.push(id + ' answer');
  if (words(x.why) < 8) errs.push(id + ' why too short');
  if (/todo|tbd|placeholder|https?:/i.test(x.prompt + x.options.join(' ') + x.why)) errs.push(id + ' banned text');
  let options = x.options.slice(), answer = x.answer;
  if (!x.fixed) { const r = rng(id), idx = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } options = idx.map(i => x.options[i]); answer = idx.indexOf(x.answer); }
  return { id, topic: x.topic, level: x.level, tag: x.tag, prompt: x.prompt, options, answer, why: x.why };
});
const dist = [0, 0, 0, 0]; out_q.forEach(x => dist[x.answer]++);
if (Math.max(...dist) / out_q.length > 0.4) errs.push('answer positions skewed: ' + dist);
for (const t of topics) if (out_q.filter(x => x.topic === t.id).length < 4) errs.push('topic too small: ' + t.id);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
fs.writeFileSync(out, JSON.stringify({ version: 1, title: 'SAP ABAP diagnostic', topics, questions: out_q }, null, 1));
const byLevel = [1, 2, 3].map(l => out_q.filter(x => x.level === l).length);
console.log(`abap-diagnostic.json: ${out_q.length} questions, per level ${byLevel}, answer positions ${dist}`);
