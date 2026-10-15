import { code, Q } from '../dsl.mjs';
export default {
  n: 3, phase: 'A', title: 'Control flow and loops',
  goal: 'Make decisions and repeat work with IF, CASE, DO and WHILE, and control a loop with EXIT, CONTINUE and CHECK.',
  objectives: ['Write IF/ELSEIF and CASE correctly', 'Use DO n TIMES, DO and WHILE', 'Know that sy-index starts at 1', 'Know exactly what EXIT, CONTINUE and CHECK do', 'Handle nested loops'],
  minutes: { read: 15, examples: 10, exercise: 20, quiz: 8, review: 7 },
  read: `## Decisions
§IF … ELSEIF … ELSE … ENDIF.§ compares with §=§ (or §EQ§), §<>§ (§NE§), §<§, §>§, §<=§, §>=§, and combines conditions with §AND§, §OR§, §NOT§.
§CASE x. WHEN 1. … WHEN OTHERS. … ENDCASE.§ is cleaner when one variable is tested against many values. Always add §WHEN OTHERS§.

## Loops
- §DO n TIMES.§ repeats n times.
- §DO.§ repeats **forever** until something ends it (§EXIT§). Without an exit it never stops.
- §WHILE condition.§ repeats while the condition is true.

Inside §DO§ the system variable **§sy-index§** counts passes, **starting at 1**. Inside a table loop the counterpart is §sy-tabix§ (Day 4).

## Steering a loop
- **§EXIT.§** leaves the loop **completely**. In nested loops it leaves **only the innermost** one; the outer loop continues.
- **§CONTINUE.§** skips the rest of this pass and starts the next.
- **§CHECK condition.§** is a shortcut: if the condition is **false**, behave like CONTINUE (inside a loop).

## Nested loops
The inner loop has its own §sy-index§. When the inner loop ends, the outer §sy-index§ is back to the outer count.

## Success check
Most statements set **§sy-subrc§**: **0 means success**, anything else means "not found / failed". You will test it constantly from Day 6 on.`,
  examples: [
    { title: 'IF and CASE', code: code("DATA gv_mark TYPE i VALUE 72.\n\nIF gv_mark >= 80.\n  WRITE: / 'Distinction'.\nELSEIF gv_mark >= 60.\n  WRITE: / 'First class'.\nELSE.\n  WRITE: / 'Below'.\nENDIF.\n\nCASE sy-datum+4(2).        \" the month part of today\n  WHEN '10'.  WRITE: / 'October'.\n  WHEN OTHERS. WRITE: / 'Another month'.\nENDCASE."), notes: 'The first matching branch runs, the rest are skipped.' },
    { title: 'DO with sy-index and EXIT', code: code("DO.\n  IF sy-index > 5.\n    EXIT.\n  ENDIF.\n  WRITE: / sy-index.   \" 1 2 3 4 5\nENDDO."), notes: 'A plain DO has no stop of its own. The EXIT is what makes it finite.' },
    { title: 'EXIT leaves only the inner loop', code: code("DO 3 TIMES.\n  DATA(lv_outer) = sy-index.\n  DO 3 TIMES.\n    IF sy-index = 2.\n      EXIT.             \" leaves the inner DO only\n    ENDIF.\n    WRITE: / lv_outer, sy-index.\n  ENDDO.\nENDDO.\n\" prints 1 1 / 2 1 / 3 1"), notes: 'The outer loop still runs all 3 passes; each inner loop stops at its second pass.' },
    { title: 'CONTINUE', code: code("DO 6 TIMES.\n  IF sy-index MOD 2 = 0.\n    CONTINUE.            \" skip even numbers\n  ENDIF.\n  WRITE: / sy-index.     \" 1 3 5\nENDDO."), notes: 'CONTINUE does not leave the loop; it jumps to the next pass.' }
  ],
  exercise: {
    title: 'Loops that behave',
    brief: 'Four small loop problems, all in one program.',
    steps: ['Create **ZABAP_D3**.', '**FizzBuzz 1–15:** print Fizz for multiples of 3, Buzz for multiples of 5, FizzBuzz for both, otherwise the number. Use DO and MOD.', '**Sum 1–100** with DO 100 TIMES. Print it (it must be 5050).', '**First n whose square is above 500:** use a plain DO and EXIT. Print n.', '**CONTINUE:** print the numbers 1 to 10 that are not multiples of 3.', 'Activate and run. Compare with the expected output.'],
    expect: ['FizzBuzz lines: 1, 2, Fizz, 4, Buzz, Fizz, 7, 8, Fizz, Buzz, 11, Fizz, 13, 14, FizzBuzz', 'Sum **5050**', 'First n **23** (22 squared is 484, 23 squared is 529)', 'Skipped list: 1 2 4 5 7 8 10'],
    hints: ['Check FizzBuzz first (multiple of 15), otherwise the 3 and 5 branches would catch it earlier.', 'Add to the sum with §gv_sum = gv_sum + sy-index.§ inside the DO.', 'For the square: §IF sy-index * sy-index > 500.§ then store sy-index in a variable and §EXIT.§'],
    solution: code("REPORT zabap_d3.\n\nDATA: gv_sum TYPE i,\n      gv_n   TYPE i.\n\nDO 15 TIMES.\n  IF sy-index MOD 15 = 0.\n    WRITE: / 'FizzBuzz'.\n  ELSEIF sy-index MOD 3 = 0.\n    WRITE: / 'Fizz'.\n  ELSEIF sy-index MOD 5 = 0.\n    WRITE: / 'Buzz'.\n  ELSE.\n    WRITE: / sy-index.\n  ENDIF.\nENDDO.\n\nDO 100 TIMES.\n  gv_sum = gv_sum + sy-index.\nENDDO.\nWRITE: / 'Sum:', gv_sum.\n\nDO.\n  IF sy-index * sy-index > 500.\n    gv_n = sy-index.\n    EXIT.\n  ENDIF.\nENDDO.\nWRITE: / 'First n:', gv_n.\n\nDO 10 TIMES.\n  IF sy-index MOD 3 = 0.\n    CONTINUE.\n  ENDIF.\n  WRITE: / sy-index.\nENDDO."),
    stretch: { brief: 'Print a 5 x 5 multiplication table using two nested DO loops. Keep the outer number in a variable, because sy-index belongs to the inner loop while it runs.', solution: 'Outer: §DO 5 TIMES. lv_row = sy-index. DO 5 TIMES. lv_prod = lv_row * sy-index. WRITE lv_prod. ENDDO. SKIP. ENDDO.§ Declare §lv_prod TYPE i§ and write each product with a width, e.g. §WRITE (4) lv_prod.§' }
  },
  tags: {
    'd3.ifcase': { title: 'IF, ELSEIF and CASE', reteach: `Conditions are checked top to bottom; the **first true branch runs** and the rest are skipped. Put the most specific test first (for FizzBuzz: multiple of 15 before 3 and 5).\n\n§CASE§ tests one variable against many values and needs §WHEN OTHERS§ for everything else. Compare with §=§ or §EQ§; not-equal is §<>§ or §NE§.\n\nCombine tests with §AND§, §OR§, §NOT§ and group them with parentheses (spaces around each).`, extra: { brief: 'Write a CASE that prints "weekend" for sy-datum-based day 6 or 7 (use §lv_day = 6.§ by hand) and "weekday" otherwise.', solution: '§CASE lv_day. WHEN 6 OR 7. WRITE \'weekend\'. WHEN OTHERS. WRITE \'weekday\'. ENDCASE.§' } },
    'd3.do': { title: 'DO, WHILE and sy-index', reteach: `§DO n TIMES.§ runs n passes. A bare §DO.§ never stops by itself, so it **must** contain an §EXIT§.\n§sy-index§ is the pass counter and **starts at 1** (not 0). After §DO 3 TIMES.§ the passes are 1, 2, 3.\n§WHILE cond.§ tests **before** each pass, so it may run zero times.`, extra: { brief: 'Print the powers of 2 below 1000 using WHILE.', solution: '§DATA lv TYPE i VALUE 1. WHILE lv < 1000. WRITE / lv. lv = lv * 2. ENDWHILE.§ prints 1 2 4 … 512.' } },
    'd3.exit': { title: 'EXIT, CONTINUE and CHECK', reteach: `§EXIT§ ends the **loop you are in**. In nested loops that is only the innermost one; the outer loop carries on.\n§CONTINUE§ abandons only the current pass.\n§CHECK cond.§ means "carry on only if cond is true", otherwise it behaves like CONTINUE inside a loop.\n\nOutside any loop, §EXIT§ leaves the whole processing block (for example the event block), which surprises many beginners.`, extra: { brief: 'Predict how many lines print: an outer §DO 3 TIMES.§ containing an inner §DO 5 TIMES.§ that does §EXIT.§ when sy-index = 3 after writing the index.', solution: 'The inner loop writes 2 lines per outer pass (indexes 1 and 2) and exits at 3, so 3 x 2 = 6 lines.' } },
    'd3.nested': { title: 'Nested loops and sy-index', reteach: `Each loop has its own §sy-index§. While the inner loop runs, §sy-index§ is the inner count; once it ends, the outer count is visible again.\n\nIf you need the outer number inside the inner loop, **copy it into a variable first**: §lv_row = sy-index.§\n\nCost: 10 x 10 passes = 100 executions; nested loops grow fast, which matters again with big tables.`, extra: { brief: 'Print all pairs (i, j) with i from 1 to 3 and j from 1 to 2. How many lines? In what order?', solution: '6 lines: 1 1, 1 2, 2 1, 2 2, 3 1, 3 2. The inner counter changes fastest.' } }
  },
  quiz: [
    Q('d3.do', 'What is the last number printed?\n' + code("DO 4 TIMES.\n  WRITE: / sy-index.\nENDDO."), '4', ['3', '5', '0'], 'sy-index starts at 1, so four passes print 1, 2, 3, 4.'),
    Q('d3.do', 'What happens with this loop?\n' + code("DO.\n  WRITE: / sy-index.\nENDDO."), 'It does not stop on its own (until the program times out)', ['It runs once', 'It runs 10 times', 'Syntax error'], 'A plain DO has no pass count. It needs an EXIT or similar to end.'),
    Q('d3.exit', 'How many lines are written?\n' + code("DO 3 TIMES.\n  DO 5 TIMES.\n    IF sy-index = 3.\n      EXIT.\n    ENDIF.\n    WRITE: / sy-index.\n  ENDDO.\nENDDO."), '6', ['2', '3', '15'], 'EXIT leaves only the inner loop. Each inner loop writes indexes 1 and 2, three times: 6 lines.'),
    Q('d3.exit', 'What does §CONTINUE.§ do inside a loop?', 'Skips the rest of this pass and starts the next one', ['Leaves the loop', 'Restarts the loop from pass 1', 'Ends the program'], 'CONTINUE jumps to the next pass; EXIT is the one that leaves.'),
    Q('d3.ifcase', 'What is printed?\n' + code("DATA gv TYPE i VALUE 30.\nIF gv > 10.\n  WRITE: / 'A'.\nELSEIF gv > 20.\n  WRITE: / 'B'.\nELSE.\n  WRITE: / 'C'.\nENDIF."), 'A', ['B', 'C', 'A and B'], 'The first true condition wins and later branches are skipped, even if they are also true.'),
    Q('d3.nested', 'Inside the inner DO, what does sy-index hold?', 'The pass count of the inner loop', ['The pass count of the outer loop', 'Always 1', 'The sum of both loops'], 'Each loop level has its own counter. Save the outer value in a variable if you need it.')
  ],
  retest: [
    Q('d3.do', 'How many passes does §DO 0 TIMES.§ make?', '0', ['1', 'Infinite', 'It is a syntax error'], 'Zero passes means the body is never entered.'),
    Q('d3.exit', 'Which statement skips to the next pass if a condition is false?', 'CHECK condition.', ['EXIT condition.', 'STOP condition.', 'BREAK condition.'], 'CHECK continues only when its condition is true, otherwise it moves to the next pass.'),
    Q('d3.ifcase', 'Which keyword covers all values not named in earlier WHEN branches?', 'WHEN OTHERS', ['ELSE', 'DEFAULT', 'WHEN ELSE'], 'In a CASE statement the catch-all branch is WHEN OTHERS.'),
    Q('d3.nested', 'An outer DO 4 TIMES contains an inner DO 3 TIMES with no EXIT. How many times does the inner body run in total?', '12', ['7', '3', '4'], 'Three passes for each of four outer passes: 4 x 3 = 12.')
  ],
  milestone: 'You can write and trace any loop with a known number of passes and explain exactly where EXIT leaves.'
};
