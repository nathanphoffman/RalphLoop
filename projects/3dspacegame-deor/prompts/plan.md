[ralph:plan round={{ROUND}} areas={{AREAS_CSV}}]
You are the planning step of the Rust-to-Deor conversion loop. Never ask questions; log assumptions in {{LOOP_DIR}}/DECISIONS.md.
Working directory is a checkout on the integration branch, after this round's merges. The goal (see {{LOOP_DIR}}/SPEC.md):
a Deor share of 90% or more and a code-quality score between 85 (the minimum target) and 90 (the maximum target), with green checks.
Quality range: keep the score between 85 (minimum target) and 90 (maximum target); go outside it only with a justification logged in {{LOOP_DIR}}/DECISIONS.md.
Do not chase the number with artificial changes.

1. Measure: run `python3 scripts/deor_share.py --by-folder` and `codequality --full`. Update {{LOOP_DIR}}/PROGRESS.md: a
   short section for round {{ROUND}} (what landed per area, what is blocked "- [!]", what failed to merge, the Deor
   share and quality score now versus last round, the largest remaining Rust folders), and the milestone checklist from
   {{LOOP_DIR}}/SPEC.md marked not started / partial / done, judged from the code and the share script, not from the
   checklists alone. Check {{LOOP_DIR}}/DEOR_BUGS.md is up to date.
2. Look at the net change in hand-written Rust per item last round (`git log --stat`, `scripts/deor_share.py`). If Rust did not go down, say so in PROGRESS.md and make this round's items bigger and caller-inclusive: whole files or folders (1,000+ lines of Rust each where possible) with every caller in the area, each told to delete the Rust it replaces.
   Test audit: compare the `#[test]` functions at the start of the loop (git commit e3d2a3f3) with now, per converted file
   (`git grep -c '#\[test\]' e3d2a3f3 -- src` against HEAD, then the names where a count dropped). For each test whose
   assertion no longer exists anywhere, write an item at the TOP of the owning area's tasks: "restore test X against the new
   code". Known loss to restore first (area open_play, src/open_play/flight/waves/tests.rs): `same_inputs_give_same_requests`
   (two spawn queues with the same inputs give equal due requests at 1000.0 seconds) and
   `a_wave_with_over_a_thousand_enemies_cannot_collide` (a 1,500-enemy wave: its kill ids must not overlap the next wave's
   first kill id). The old versions are in `git show e3d2a3f3:src/open_play/flight/waves/spawn/tests.rs`.
   Also look at everything already converted (every `deor/` folder): where Rust still builds request structs, calls one Deor function and unpacks the answer, or keeps a thin copy of what the Deor now does, write a cleanup item for the area that owns it: "move the callers of X into Deor and delete the leftover Rust". Put these cleanup items FIRST, before new conversions, until no converted slice leaves Rust that could be Deor.
   Write the next round's task files {{LOOP_DIR}}/tasks/<area>.md for these areas: {{AREAS_CSV}}, replacing the old ones
   (keep the same header style). Each gets at most 8 "- [ ]" items, each sized for one Claude session: convert a whole
   module or a few related files (as large as one session can finish: a whole folder or several related files, 500 to 2,000 lines of Rust, including their callers), naming the exact files or folder. Aim every round at the
   biggest remaining Rust by lines, in SPEC.md's order of work. Respect ownership in {{LOOP_DIR}}/CONTRACTS.md. Items in
   one area must not depend on unmerged work from another area in the same round (items that need a new helper wait a
   round, or the area adds the helper itself as an integration-point addition). Carry over unfinished or blocked work in a
   fixable form. Put one "run the share script and codequality, record the numbers in PROGRESS.md" item last.
   If the Deor share has not risen for two rounds, write down why in PROGRESS.md and change tactics (a bigger helper
   library, converting a state struct first, splitting the blocked file); do not stop.
3. Only when the share is 90.0 or more, codequality's total is 85.0 or more (the range is 85 to 90; a score above 90 is fine but never a goal), every milestone in SPEC.md is done, the "Done
   means" section is true, and the full checks are clean, create the empty file {{STATE_DIR}}/COMPLETE and write no
   further tasks. Otherwise do not create it. If the share is 90+ but quality is below 85, write quality-only tasks for genuine fixes only.
   If {{LOOP_DIR}}/SPEC.md still says the quality goal is 90, change its Goal and "Done means" lines to the 85 to 90 range.
   Full checks:
   {{FULL_CHECK}}
4. Commit everything under {{LOOP_DIR}}/ ("ralph: round {{ROUND}} progress and next tasks").
