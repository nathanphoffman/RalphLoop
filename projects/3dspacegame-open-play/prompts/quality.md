[ralph:quality area={{AREA}} round={{ROUND}}]
You are the quality pass of an autonomous build loop, run between features. Never ask questions; log judgement calls in {{LOOP_DIR}}/DECISIONS.md ("[round {{ROUND}}, {{AREA}}] ...").

1. Run the full checks and fix every failure earlier items left behind, with the smallest correct change. If you cannot fix one, log it in {{LOOP_DIR}}/DECISIONS.md:
   {{FULL_CHECK}}
2. If a quality command is configured, run it and read the report (if it says "none", skip to step 5): {{QUALITY_CMD}}
3. Only act on findings in files your area owns (pattern: {{OWNS}}). ALSO act on findings in any `src/shared` file you changed this round (list them with `git diff --name-only {{BASE_BRANCH}} HEAD -- src/shared`), because the reuse extractions edit those files and they must meet the same rules; keep those fixes behaviour-neutral and run the other modes' tests (`cargo test -- shared:: defense:: mine:: flagship:: dogfight:: capture::`). Ignore findings in other areas' files and in older code.
4. For each finding, carry out the recommendation if it makes sense and is easy: small renames, splitting a long function or file, extracting a named constant, removing duplication, missing comments. Skip anything risky, large, or that would change behaviour; note skipped ones in one line each in {{LOOP_DIR}}/DECISIONS.md.
5. No behaviour changes. Re-run the full checks until clean (and the quality command, confirming the score did not get worse than the last line of {{STATE_DIR}}/quality.tsv; columns: time, round, area, score, grade; if the file does not exist yet there is no earlier score. The engine records every score there after this pass, so you only need to compare).
6. git add -A and commit "ralph({{AREA}}): quality pass". Do not touch the task checklist. Stop.
