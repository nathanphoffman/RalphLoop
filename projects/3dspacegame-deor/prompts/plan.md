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
   Blocked items: read the reason on every "- [!]" line. When the reason is "Rust struct/type X is used by Rust" (Plan, Room, Tunnel,
   Lamp, MineLayout, contract types, Player, Enemy, Game state), write ONE item that turns X into a Deor struct AND updates every Rust
   file that uses X in the same session (fields become f64, Vec3 fields become `raw` with helpers), then convert the logic that works on
   X. Put these first in the area's list, sized to a whole folder, and name every file that uses X. Do not leave a blocked item blocked
   because its types are Rust: converting the type is the item.
   Split `Game` (src/shared/game/mod.rs) into small groups. Write items for the shared area, first in its list, that move the
   small fields of `Game` into a few Deor structs: for example `HudState` (toast, warning, kill_pops, hull_sparks, speed_trail,
   viewed_target, ping_millis) and `CheatState` (typed_letters, cheats_enabled), with one Deor update function per group. `Game`
   keeps owning the groups; each frame Rust passes a group in and stores the returned group. Update every Rust user of the moved
   fields in the same session. Do NOT move the big entity lists (lasers, missiles, enemies, enemy_shots, pickups, particles),
   `player`, `remote_players` or `mode_state` into Deor values: they stay in Rust behind `GameHandle`, updated by one Deor call
   per list per frame.
   Shrink the engine Rust. Goal: the Rust that touches macroquad, sockets, files and audio is as small and isolated as possible,
   one thin set of general primitives (draw_rect, draw_text, draw_line, draw_mesh, play_sound, send_bytes, receive_bytes,
   read_text, write_text and the like, each one or two lines) that Deor calls from everywhere. Audit every `rust` block in a
   .deor file and every hand-written Rust file that calls macroquad, std::net or std::fs: where a wrapper exists for one feature
   (draw_kill_pop, draw_status_box, send_laser_message) and a general primitive could serve it, write a cleanup item to move
   the layout, colour, timing and encoding into Deor, call the shared primitive, and delete the one-off wrapper. Keep the
   primitives in one place per kind (for example `src/shared/engine/`), tested where they can be. Put these items after the
   struct-first and Game-splitting items, and count the Rust lines before and after.
   If the Deor share has not risen for two rounds, write down why in PROGRESS.md and change tactics (a bigger helper
   library, converting a state struct first, splitting the blocked file); do not stop.
3. Only when the share is 90.0 or more, codequality's total is 85.0 or more (the range is 85 to 90; a score above 90 is fine but never a goal), every milestone in SPEC.md is done, the "Done
   means" section is true, and the full checks are clean, create the empty file {{STATE_DIR}}/COMPLETE and write no
   further tasks. Otherwise do not create it. If the share is 90+ but quality is below 85, write quality-only tasks for genuine fixes only.
   If {{LOOP_DIR}}/SPEC.md still says the quality goal is 90, change its Goal and "Done means" lines to the 85 to 90 range.
   Full checks:
   {{FULL_CHECK}}
   Related items in one area: when an item builds directly on the one above it in the same list (same folder or same types, so the
   files it needs are already loaded), start its line with `(continues previous)`, for example
   `- [ ] (continues previous) mine layout 2 of 4 ...`. The worker then resumes the previous item's Claude conversation
   instead of starting cold. Aim to chain related items in groups of about {{GROUP_TARGET}}, and never more than {{GROUP_MAX}} in
   a row. This is a preference, never a rule: do not reorder items or force unrelated ones together to reach it, and a
   group of 1 is fine. Tag only items that really share context; leave the first item
   of every list and unrelated items untagged.
   Parked items: each round, read every `- [!]` item's note. If the note says the item is glue, would add Rust ("no
   net-negative conversion"), or waits on another item, do NOT write it back as `- [ ]` this round. Move it under a
   `## Parked` heading at the end of that area's task file, keep its text, and add one line: `Unparks when: <a fact you can
   check>` (for example "the item that makes `Game` a Deor struct has merged", or "shared exports an `Enemy` entry point for
   mine"). Every round, check each parked item's condition against the code and PROGRESS.md; if it is now true, move the item
   back into the open list (and tag it `(continues previous)` only if it follows related work). If the item is blocked
   because Deor itself cannot do it, say so in the line, and list it in PROGRESS.md under "Needs Deor help" so the user sees it.
   A parked item costs no sessions. Also count the parked Rust lines in PROGRESS.md, so the user can see the ceiling on the
   Deor share.
   Player bugs: read {{LOOP_DIR}}/BUGS.md every round. Every bug whose Status is Open or Reopened must have a `BUG FIRST` item
   at the top of its area's list (keep it above all conversion items, never parked, never blocked, and never tagged
   `(continues previous)`). When BUGS.md says Fixed, drop the item and carry on with conversion work. If a Fixed bug
   has no measured numbers in BUGS.md, treat it as still open.
   Bugs that need a human check: if a bug's Status in BUGS.md is `Needs human check` (or its note says it was "left Open for
   a human check", or the numbers rule out the code and only a real window could show more), do two things this round.
   (1) Drop its `BUG FIRST` item so it stops holding the top of the list, and set its Status to `Needs human check` yourself.
   (2) Add ONE item `TIMING LOGS (bug N)` near the top of the area that owns the code (cross-area edits are allowed for it):
   add small, cheap timing log lines to the real game with `std::time::Instant`, printed to stderr only when a step goes
   over its limit, and switched off by the environment variable `NO_TIMING_LOGS`. Cover the places a test cannot time:
   for the undock freeze, the click on Undock, the end of the scene build, and the first drawn flight frame; for the Esc lag,
   the time from the Esc press to the first drawn pause-page frame and the first drawn frame after resume; and for any bug, any
   frame over 50 ms with the name of the screen it was on. Use the existing profiler module if it fits. One shared helper,
   no copies. Keep the lines out of tests. Then write in BUGS.md how to read them. When the user reports numbers or the bug
   again, a human sets the Status back to Open or Reopened; until then do not spend sessions on that bug.
4. Commit everything under {{LOOP_DIR}}/ ("ralph: round {{ROUND}} progress and next tasks").
