[ralph:quality area={{AREA}} round={{ROUND}}]
You are the quality pass of the Deor rewrite loop, run between items. Never ask questions; log judgement calls in
{{LOOP_DIR}}/DECISIONS.md ("[round {{ROUND}}, {{AREA}}] ...").

1. Run the full checks and fix every failure earlier items left behind with the smallest correct change. If you cannot
   fix one, log it in {{LOOP_DIR}}/DECISIONS.md:
   {{FULL_CHECK}}
2. Run the report command and read it: {{QUALITY_CMD}}
   It prints the Deor share by folder and the code-quality score. The share goal is 90; the quality range is 85 (minimum)
   to 90 (maximum). Go outside the range only with a reason logged in DECISIONS.md, and never chase the number with
   artificial changes (renames for the score, splitting files that read fine, padding comments).
3. Only act in files your area owns (pattern: {{OWNS}}); ignore other areas' files.
   Architecture audit, the part that matters most in this loop. Look at what the last items added and fix what breaks
   {{LOOP_DIR}}/PLAN.md section 4:
   - a `rust` block with an `if`, a loop, or more than one line, or one used from a single place (rule 6);
   - a helper called inside a hot loop with a list or a list-holding struct argument, or a per-frame struct holding a
     string or a nested list (rules 1 and 2);
   - a world part rebuilt with `with`, or passed without `move` (rule 3);
   - a `for entity in list` loop that writes `list at idx` (rule 8);
   - a `use` line in a `rust` block outside `src/engine/prelude_wrappers.deor` (rule 9);
   - a name or enum variant that `scripts/check_deor_names.py` would flag, or a shared type declared twice (rule 5);
   - a Deor file still in the old per-file build whose Rust callers all moved (move it into `src/game.deor`);
   - Rust left behind that only builds a request, calls one Deor function and unpacks the result;
   - a `GameHandle`, `borrow_mut` or `RefCell` anywhere outside the engine.
   Fix each with a behavior-neutral change, or log why not in DECISIONS.md.
4. Then the code-quality findings in the changed files: renames, splitting a long function or file (under about 150
   lines), named constants (a macro in Deor), duplication, missing file comments, long Deor functions. Skip risky or large
   changes and note each skipped one in DECISIONS.md.
5. No behavior changes. Generated .rs files are never edited by hand: edit the .deor and run `sh scripts/build_deor.sh`.
   Never edit Deor, lib/ or deor_specification/. Re-run the full checks until clean and the report command, confirming
   neither the share nor the quality score got worse.
6. git add -A and commit "ralph({{AREA}}): quality pass". Do not touch the task checklist. Stop.
