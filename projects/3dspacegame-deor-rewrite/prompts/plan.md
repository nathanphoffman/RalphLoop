[ralph:plan round={{ROUND}} areas={{AREAS_CSV}}]
You are the planning step of the Deor rewrite loop. Never ask questions; log assumptions in {{LOOP_DIR}}/DECISIONS.md.
Working directory is a checkout on the integration branch, after this round's merge. The plan is {{LOOP_DIR}}/PLAN.md;
{{LOOP_DIR}}/SPEC.md lists its phases as milestones a to h with exit criteria. The goal: a Deor share of 90% or more
(`python3 scripts/deor_share.py`), code quality between 85 and 90 (`codequality --full`), green checks, and parity with
`main` (PLAN.md section 11).

1. Measure: run `python3 scripts/deor_share.py --by-folder` and `codequality --full`. Update {{LOOP_DIR}}/PROGRESS.md
   with a short section for round {{ROUND}}: what landed, what is blocked ("- [!]"), the share and quality now against last
   round, the hand-written Rust left per folder, the current phase and its exit criteria judged from the code and tests
   (not from the checklist), the `cargo build` time after a one-line Deor change when the round measured it, and the
   milestone checklist from SPEC.md (not started / partial / done). SPEC.md is the source of truth for the milestones; add
   any it lists that PROGRESS.md is missing.
2. Judge the phase. A phase is done only when every line of its exit criterion in SPEC.md is true in the code: the named
   Rust is deleted (grep for it), the tests pass, the timing budgets hold. Do not start the next phase's items while the
   current phase has exit criteria open, except small preparatory items that need nothing from the open ones.
3. Write the next round's task files {{LOOP_DIR}}/tasks/<area>.md for these areas: {{AREAS_CSV}}, replacing the old
   ones, keeping the header style. Each gets at most 8 "- [ ]" items, each sized for one session: a whole module or folder with its callers (500 to 2,000 Rust lines),
   naming the exact files, the Rust to delete, the source to port from (this branch's Deor, or `main` for Open Play and
   for every PLAN.md section 11 feature), the tests to carry, and the timing budget when it loops over thousands of items.
   Follow the phase order in SPEC.md and PLAN.md section 5. Respect ownership in CONTRACTS.md: an item touches only its
   area's files (plus the cross-area mechanical edits CONTRACTS.md allows for a type's owner). Items in one area must not
   depend on another area's unmerged work from the same round; when a phase belongs mostly to one area, the other areas
   get the preparatory work that needs nothing from it (porting pure rules and data from `main` or this branch into
   Deor files not yet imported by `game.deor`, the ENUMS.md designs, tests pinning behavior, the do-not-port audit), or
   fewer items (a file with no "- [ ]" is fine). Items that build on the one above start with
   `(continues previous)` (groups of about {{GROUP_TARGET}}, never more than {{GROUP_MAX}}); the first item and unrelated
   items stay untagged. Put one "run the share script and codequality, record the numbers in PROGRESS.md" item last.
   Blocked items: read every "- [!]" note. "The type is Rust" is never a reason: the item that makes the type a Deor
   struct and updates every user is the item. "Needs the user (Deor)" items go under a `## Needs the user` heading at the
   end of the task file with the DEOR_BUGS.md entry named, and are listed in PROGRESS.md so the user sees them; they cost
   no sessions until the user changes DEOR_BUGS.md. Other blocked items are carried over in a fixable, smaller form.
   Player bugs: every bug in {{LOOP_DIR}}/BUGS.md whose Status is Open or Reopened gets a `BUG FIRST` item at the top.
   Copy cost: when an item loops over thousands of cells, pixels, vertices or entities, say in the item that the loop must
   read big lists in place (or use `move` or a macro) and must have a timing test.
   Names: when an item moves a file into the single program, say that `scripts/check_deor_names.py` must pass and that
   the Rust callers switch to `crate::game::` in the same commit.
   Not porting: PLAN.md section 6 lists the Deor on this branch that must not move (removed or replaced on `main`); an
   item that reaches one of those ports `main`'s replacement instead, and says so.
4. Phase boundaries. When the exit criterion of a phase has just become true in this round, write in PROGRESS.md what the
   user should try in the game (the loop does not pause by itself; the user creates {{STATE_DIR}}/PAUSE to stop after a
   round). Phase 2 is the go or no-go point of the whole plan: say plainly whether `step_world` meets its budget, and if
   it does not, write the items that fix it before anything from Phase 3.
5. COMPLETE: only when every milestone in SPEC.md is done, its "Done means" section is true (share 90.0 or more, quality
   85.0 or more, every section 11 feature checked off in PROGRESS.md with a guarding test), and the full checks are clean,
   create the empty file {{STATE_DIR}}/COMPLETE and write no further tasks. Otherwise do not create it. Full checks:
   {{FULL_CHECK}}
6. Commit everything under {{LOOP_DIR}}/ ("ralph: round {{ROUND}} progress and next tasks").
