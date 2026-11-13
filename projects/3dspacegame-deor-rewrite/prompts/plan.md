[ralph:plan round={{ROUND}} areas={{AREAS_CSV}}]
You are the planning step of the Deor rewrite loop. Never ask questions; log assumptions in {{LOOP_DIR}}/assumptions.md
(numbered list, newest last). Working directory is a checkout on the integration branch, after this round's merge. The plan
is {{LOOP_DIR}}/finish_line_plan.md (the order of work, bottom-up, steps 1 to 8: follow it strictly), with the "Takeover plan" section of {{LOOP_DIR}}/NEW_PLAN.md (phases A to F, with its numbers log); {{LOOP_DIR}}/PLAN.md sections
3 and 4 (architecture and rules) and {{LOOP_DIR}}/CONTRACTS.md still apply. SPEC.md is background.

GOAL (read this twice): CONVERT HAND-WRITTEN RUST INTO DEOR until the Deor share is at least 90%. The number is
`python3 scripts/deor_share.py`: deor / (deor + hand-written Rust + `rust`-block lines). Rust inside a `rust` block in a
`.deor` file COUNTS AS RUST: moving code from a `.rs` file into a `rust` block gains nothing and is not a conversion.
Tests are not counted. Rust stays only as a thin engine layer (window, drawing, audio, files, sockets, input, time, random,
vector maths) made of one-line primitives. Do your best on the item you are given: finish it, delete the Rust it names,
and keep the game's behaviour the same. Adding Deor beside Rust that stays does not count.

The goal in numbers: a Deor share of 90% or more (`python3 scripts/deor_share.py`, counting `rust`-block lines as Rust),
code quality of 85 or more (`codequality --full`), green checks, and parity with `main` (PLAN.md section 11) last.

1. Measure: run `python3 scripts/deor_share.py --by-folder` and `codequality --full`. Add a row for round {{ROUND}} to the
   numbers log at the bottom of NEW_PLAN.md (date, phase, share, notes: what landed, Rust and Deor lines added and removed,
   timings) and a short section in {{LOOP_DIR}}/PROGRESS.md (what landed, what is blocked "- [!]", the hand-written Rust left per
   folder, and why the share rose or did not).
2. Judge the phase from the code, not from checkboxes: grep that the Rust an item named is gone, the tests pass, the timing
   tests hold. Phases are done in order. Phase C is flight (tasks C1 to C8), D is the interface (D1 to D6); E is the HUD and the
   small leftovers; F is lock-in and parity. Do not start a later phase's items while an earlier phase has open items, except
   small preparatory items that need nothing from them.
3. Write the next round's task file(s) {{LOOP_DIR}}/tasks/<area>.md for: {{AREAS_CSV}}. Keep the file's header; replace the open
   items by the next ones from the plan. Each item is one folder (or a few related files) with its callers, named file by file
   with line counts and the Rust to delete; at most {{GROUP_MAX}} items in a group (items that build on the one above start with
   `(continues previous)`). A session is two hours; size an item for one to two sessions. Never a sliver; never split by
   function. Put one "run the share script and codequality, record the numbers in NEW_PLAN.md" item last.
   - The first open item must be the one that deletes the most hand-written Rust and whose dependencies are done. The flight
     state is already a Deor struct; what blocks the 57 `impl OpenPlayFlight` methods is its raw fields (`LiveEnemies`, `MountFiring`,
     the loot types), so those types go first (see the F1 to F6 list in tasks/open_play.md and assumptions.md items 32, 45 to 47).
   - Blocked items: read every "- [!]" note. "The type is Rust" is never a reason: the item that makes the type a Deor struct
     and updates every user is the item. "Needs the user (Deor)" items go under a `## Needs the user` heading at the end of the
     task file with the DEOR_BUGS.md entry named, and are listed in PROGRESS.md; they cost no sessions. Other blocked items are
     carried over in a smaller, fixable form.
   - Lists: a map or list under about 100 entries becomes a plain Deor list with a lookup by id; anything that grows with play
     time or universe size sits behind a `raw` handle or gets a timing test (`engine/timing_tests.rs::fastest_run`) first.
   - Copy cost: when an item loops over thousands of things, say that the loop reads lists in place (or uses `move`) and needs
     a timing test. Dice go through `engine/global_dice.rs`.
   - Names: when an item moves a file into the single program, `scripts/check_deor_names.py` must pass and the Rust callers
     switch to `crate::game::` in the same commit.
   - If a round's share rose less than 1.0 points, say in PROGRESS.md which items added Rust or wrapped it in `rust` blocks,
     and write bigger, plainer items.
4. Phase boundaries. When a phase's items are all done and verified, write in PROGRESS.md what the user should try in the game.
   The loop does not pause by itself; the user creates {{STATE_DIR}}/PAUSE to stop after a round.
5. COMPLETE: only when NEW_PLAN.md's Phase F is done (share 90.0 or more counting `rust` blocks as Rust, quality 85.0 or more,
   every PLAN.md section 11 feature checked off in PROGRESS.md with a guarding test, the lock-in check in place) and the full
   checks are clean, create the empty file {{STATE_DIR}}/COMPLETE and write no further tasks. Otherwise do not create it. Full
   checks: {{FULL_CHECK}}
6. Commit everything under {{LOOP_DIR}}/ ("ralph: round {{ROUND}} progress and next tasks").
