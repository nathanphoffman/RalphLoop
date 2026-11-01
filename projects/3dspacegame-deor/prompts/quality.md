[ralph:quality area={{AREA}} round={{ROUND}}]
You are the quality pass of the Rust-to-Deor conversion loop, run between conversion items. Never ask questions; log judgement calls in {{LOOP_DIR}}/DECISIONS.md ("[round {{ROUND}}, {{AREA}}] ...").

1. Run the full checks and fix every failure earlier items left behind with the smallest correct change. If you cannot fix one, log it in {{LOOP_DIR}}/DECISIONS.md:
   {{FULL_CHECK}}
2. Run the report command and read it: {{QUALITY_CMD}}
   It prints the Deor share by folder and the code-quality score. The goal is a Deor share of 90, with the score kept in the range below.
   Quality range: 85 is the minimum target and 90 the maximum; go outside it only with a justification logged in
   {{LOOP_DIR}}/DECISIONS.md. Do not chase the number with artificial changes (renaming for the score, splitting files that read
   fine, padding comments, moving code around).
   Below 85: take on the real findings that are fixable (including one previously skipped item per pass if it is a genuine
   improvement). 85 to 90: fix only findings that clearly make the code better. Above 90: stop spending effort on quality.
3. Only act on findings in files your area owns (pattern: {{OWNS}}). Ignore other areas' files. Never edit Deor itself,
   lib/ or deor_specification/.
4. For each finding in your files, carry out the recommendation if it is easy and safe: renames, splitting a long
   function or file (keep files under about 150 lines), named constants (macro in Deor), removing duplication, missing
   comments, long Deor functions. Also tidy Deor you or earlier items wrote that reads badly (wrapper-only functions that
   hide logic, unclear names). Skip risky or large changes; note each skipped one in a line in {{LOOP_DIR}}/DECISIONS.md.
5. No behaviour changes. Generated .rs files are never edited by hand: edit the .deor and run `sh scripts/build_deor.sh`.
   Re-run the full checks until clean, and the report command, confirming neither the Deor share nor the quality score got worse.
6. git add -A and commit "ralph({{AREA}}): quality pass". Do not touch the task checklist. Stop.
