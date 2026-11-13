[ralph:quality area={{AREA}} round={{ROUND}}]
You are the quality pass of the Supernova Run loop, run between items. Never ask questions; log judgement calls in
{{LOOP_DIR}}/DECISIONS.md ("[round {{ROUND}}, {{AREA}}] ...").

1. Run the full checks and fix every failure earlier items left behind with the smallest correct change. If you cannot
   fix one, log it in {{LOOP_DIR}}/DECISIONS.md:
   {{FULL_CHECK}}
   If only the Deor share check fails (under 80%), do not move Rust into `rust` blocks: raise it by deleting Rust that removed
   features left behind and by writing logic that is still in Rust as Deor. If that is not possible, say so in DECISIONS.md.
2. Run the report command and read it: {{QUALITY_CMD}}
   It prints the Deor share by folder and the code-quality score. The share must be at least 80 and the aim is 85 (`rust`-block
   lines count as Rust; never move Rust into `rust` blocks to raise it); the quality range is 85 (minimum) to 90 (maximum). Go
   outside the range only with a reason logged in DECISIONS.md, and never chase the number with artificial changes.
3. Only act in files your area owns (pattern: {{OWNS}}). Audit what the last items added, against CLAUDE.md and PLAN.md section 8:
   - Rust that holds game logic (it belongs in Deor), a `rust` block with an `if` or a loop, or Rust that only builds a request,
     calls one Deor function and unpacks the result;
   - dead code the removed features left behind: unused functions, structs, imports, exports, `import` lines in `src/game.deor`,
     messages, tests of deleted features, doc and comment text that names removed features (CLAUDE.md rule 12);
   - a name or enum variant `scripts/check_deor_names.py` would flag; a magic number; a function over 36 lines; nesting deeper than 3.
   Fix each with a behavior-neutral change, or log why not.
4. No behavior changes. Generated .rs files are never edited by hand: edit the .deor and run `sh scripts/build_deor.sh`.
   Never edit Deor, lib/ or deor_specification/. Re-run the full checks until clean and the report command, confirming
   neither the share nor the quality score got worse.
5. git add -A and commit "ralph({{AREA}}): quality pass". Do not touch the task checklist. Stop.
