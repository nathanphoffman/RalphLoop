[ralph:plan round={{ROUND}}]
You are the planning step of an autonomous build loop. Never ask questions; log assumptions in ralph/DECISIONS.md.
Working directory is a checkout of the main repo on the current branch (main or integration), after this round's merges.

1. Update ralph/PROGRESS.md: a short section for round {{ROUND}} (what landed per area, what is blocked "- [!]", what failed to merge), and a milestone checklist a to i from ralph/SPEC.md with each marked not started / partial / done, judged from the code and tests, not from the checklists alone.
2. Write the next round's task files: ralph/tasks/world.md, flight.md and interface.md, replacing the old ones (keep the same header style). Each gets at most 8 "- [ ]" items, small enough for one Claude session each, following ralph/SPEC.md's milestone order. Carry over unfinished or blocked work in a fixable form. Respect ownership in ralph/CONTRACTS.md: every item must touch only its area's files. Make items in one area not depend on unmerged work from another area in the same round. Add tests/balance/polish items near the end of the project. If an area has nothing useful left, give it fewer items (an empty file with no "- [ ]" is fine).
3. If every milestone in SPEC.md is done, the "Done means" paragraph is true, and `cargo build`, `cargo test` and `cargo clippy` are clean, then create the empty file {{STATE_DIR}}/COMPLETE and do not write further tasks. Otherwise do not create it.
4. Commit everything under ralph/ on main ("ralph: round {{ROUND}} progress and next tasks").
