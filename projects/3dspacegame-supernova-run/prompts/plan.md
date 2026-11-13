[ralph:plan round={{ROUND}} areas={{AREAS_CSV}}]
You are the planning step of the Supernova Run loop. Never ask questions; log assumptions in {{LOOP_DIR}}/DECISIONS.md (numbered
list, newest last). Working directory is a checkout on the integration branch, after this round's merge. The plan is
{{LOOP_DIR}}/PLAN.md: section 1 ("The Supernova Run": the rules, the defaults and phases 0 to 7) and section 5 (carried-over work
items), with {{LOOP_DIR}}/SPEC.md (the done-means checklist) and {{LOOP_DIR}}/CONTRACTS.md. Follow the phases in order.

THE DEOR RULE (this decides whether the run continues)
The Deor share must stay AT LEAST 80% and should be 85% or more (`python3 scripts/deor_share.py`; `rust` blocks count as Rust).
New logic and content is Deor; Rust is only a thin engine wrapper or a measured performance need. The full check fails
below 80%.

1. Measure: run `python3 scripts/deor_share.py --by-folder` and `codequality --full`. Add a short section to {{LOOP_DIR}}/PROGRESS.md
   for round {{ROUND}}: what landed, what is blocked "- [!]", the Deor and Rust line counts and the share, and a checklist
   of SPEC.md's done-means and of every phase and every section 5 item (not started / partial / done), judged from the code and the
   tests, not from the checkboxes alone.
2. STOP RULE. If an item was blocked with `DEOR SHARE`, or the share is under 80.0 and you cannot write a plan that raises it
   (name each approach tried in PROGRESS.md), then the run must stop: write {{LOOP_DIR}}/STOPPED_DEOR_SHARE.md (the share, what
   was tried, what the user must decide), write NO open "- [ ]" items, and do NOT create COMPLETE. The loop stops when
   there are no open items. Otherwise, if the share is between 80 and 85, say in PROGRESS.md what raises it.
3. Write the next round's task file {{LOOP_DIR}}/tasks/<area>.md for: {{AREAS_CSV}}. Keep the file's header; replace the open items by
   the next ones from the plan. Each item is one feature or folder with its callers, named file by file with line counts and
   the Rust and Deor to delete or add; at most {{GROUP_MAX}} items in a group (items that build on the one above start with
   `(continues previous)`). A session is two hours; size an item for one session. Never a sliver. Put one "run the share
   script and codequality, record the numbers in PROGRESS.md" item last.
   - Order: phase 0, then phase 1 (strip to Sol and one ship), 2 (the run: clock, start, Game Over), 3 (zones, scoring, the nav,
     mines), 4 (the shop and permanent upgrades), 5 (speed: the 4x-speed precision check first, then cruise), 6 (multiplayer and
     flagship), 7 (high scores, tuning, verification). The section 5 items go where they fit: planet detail and the Mine
     Liberation planet draw after phase 3 starts, the asteroid belt, star spikes, stations as auto-pilot targets and half speed in
     mines next to the phase they touch, missiles-like-guns only if wave defense's cockpit needs it, the cruise sound last.
     Do not start a later phase's items while an earlier phase has open items, except small preparatory items.
   - Phase 1 is deletion: delete whole features together (Deor and its Rust glue and tests), so the share does not dip under 80
     in any round. Put the features with the most Rust glue first (the station screens, the star map).
   - Blocked items: read every "- [!]" note. Other blocked items are carried over in a smaller, fixable form. "Needs the user
     (Deor)" items go under a `## Needs the user` heading at the end of the task file and are listed in PROGRESS.md.
   - Things only the user can judge (how it feels, the numbers) are done with the defaults in PLAN.md, logged in DECISIONS.md, and
     listed in PROGRESS.md under "To tune by playing". They never block a phase.
4. COMPLETE: only when every phase 0 to 7 and every section 5 item is done (the exceptions: the Deor test wiring T2 and T3 in
   section 4 are out of scope, and items needing the user's machine are listed in PROGRESS.md), the SPEC.md done-means are true,
   the Deor share is 80.0 or more (85 is the aim), and the full checks are clean, create the empty file {{STATE_DIR}}/COMPLETE and
   write no further tasks. Otherwise do not create it. Full checks:
   {{FULL_CHECK}}
5. Commit everything under {{LOOP_DIR}}/ ("ralph: round {{ROUND}} progress and next tasks").
