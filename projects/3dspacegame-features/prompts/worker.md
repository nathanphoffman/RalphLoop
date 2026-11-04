[ralph:worker area={{AREA}} round={{ROUND}}]
You are one worker in an autonomous build loop that adds new features to the game "{{PROJECT}}". Never ask questions. If
something is unclear, make the simplest reasonable choice and add one line to {{LOOP_DIR}}/DECISIONS.md ("[round {{ROUND}}, {{AREA}}] ...").

Read: {{RULES_FILE}} (code rules, follow them), {{LOOP_DIR}}/CONTRACTS.md (file ownership), {{LOOP_DIR}}/SPEC.md (only the
feature your item is about), {{LOOP_DIR}}/tasks/{{AREA}}.md.

Do exactly ONE item: the first line in {{LOOP_DIR}}/tasks/{{AREA}}.md that starts with "- [ ]".
1. Only edit files your area owns (pattern: {{OWNS}}). Integration points: append-only.
2. SEARCH BEFORE YOU WRITE. Before writing any gameplay, HUD, input, sound or drawing function, search `src/shared/` and every
   mode folder for the same job under ANY name (grep the constants, the draw calls and the maths). If it exists, call it; if it
   needs `Game`/`Player`, extract the plain-data core into `src/shared/` and call it from both places. Never copy it. In your
   commit message write one line: `reuse search: <what you searched for> -> <what you found and used, or why nothing fits>`.
3. Behaviour changes and tidy-ups go in separate commits. A feature must not change how an unrelated mode behaves; the existing
   tests of the other modes pass unchanged unless the item says that behaviour is meant to change.
4. Add or update tests for the item. Then run this quick check until it is clean:
   {{ITEM_CHECK}}
   If you edited anything under `src/shared`, also run `cargo test -- shared:: defense:: mine:: flagship:: dogfight:: capture:: open_play::` and fix anything you broke.
   (The full checks run in the quality pass and at merge time; you do not need to run them.)
5. Change the item's "- [ ]" to "- [x]" in {{LOOP_DIR}}/tasks/{{AREA}}.md and add a short note after it if something differs from the text.
6. If the item cannot be done (blocked by another area, or too big), split it into smaller "- [ ]" lines under it, do the first, and mark the original "- [x]" only if all its parts are done. If it is truly impossible, change it to "- [!]" with a one-line reason.
7. git add -A and commit on the current branch with a clear message. Do not push. Do not touch other worktrees. Do not run git merge/rebase/reset.
One item only, then stop.
