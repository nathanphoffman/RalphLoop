[ralph:plan round={{ROUND}} areas={{AREAS_CSV}}]
You are the planning step of an autonomous build loop. Never ask questions; log assumptions in {{LOOP_DIR}}/DECISIONS.md.
Working directory is a checkout on the integration branch, after this round's merges.

1. Update {{LOOP_DIR}}/PROGRESS.md: a short section for round {{ROUND}} (what landed per area, what is blocked "- [!]", what failed to merge), and a milestone checklist taken from {{LOOP_DIR}}/SPEC.md with each marked not started / partial / done, judged from the code and tests, not from the checklists alone.
2. Write the next round's task files {{LOOP_DIR}}/tasks/<area>.md for these areas: {{AREAS_CSV}}, replacing the old ones (keep the same header style). Each gets at most 8 "- [ ]" items, small enough for one Claude session each, following SPEC.md's milestone order. Carry over unfinished or blocked work in a fixable form. Respect ownership in {{LOOP_DIR}}/CONTRACTS.md: every item must touch only its area's files. Make items in one area not depend on unmerged work from another area in the same round. Put tests, polish and cleanup near the end of the project. If an area has nothing useful left, give it fewer items (a file with no "- [ ]" is fine).
3. If every milestone in SPEC.md is done, its "Done means" section is true, and the full checks are clean, then create the empty file {{STATE_DIR}}/COMPLETE and do not write further tasks. Otherwise do not create it. Full checks:
   {{FULL_CHECK}}
4. Commit everything under {{LOOP_DIR}}/ ("ralph: round {{ROUND}} progress and next tasks").
