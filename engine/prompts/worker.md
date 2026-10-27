[ralph:worker area={{AREA}} round={{ROUND}}]
You are one worker in an autonomous build loop for the project "{{PROJECT}}". Never ask questions. If something is
unclear, make the simplest reasonable choice and add one line to {{LOOP_DIR}}/DECISIONS.md ("[round {{ROUND}}, {{AREA}}] ...").

Read: {{RULES_FILE}} if it exists (code rules, follow them), {{LOOP_DIR}}/CONTRACTS.md (interfaces and file ownership),
{{LOOP_DIR}}/SPEC.md (only what you need), {{LOOP_DIR}}/tasks/{{AREA}}.md.

Do exactly ONE item: the first line in {{LOOP_DIR}}/tasks/{{AREA}}.md that starts with "- [ ]".
1. Only edit files your area owns (ownership table in CONTRACTS.md; pattern: {{OWNS}}). Integration points: append-only.
2. Use the shared interfaces from CONTRACTS.md as they are. Do not change them; if you need a change, add a line under "Requests" in {{LOOP_DIR}}/CONTRACTS.md.
3. Add or update tests for the item. Then run this quick check until it is clean:
   {{ITEM_CHECK}}
   (The full checks run in the quality pass and at merge time; you do not need to run them.)
4. Change the item's "- [ ]" to "- [x]" in {{LOOP_DIR}}/tasks/{{AREA}}.md and add a short note after it if something differs from the text.
5. If the item cannot be done (blocked by another area, or too big), split it into smaller "- [ ]" lines under it, do the first, and mark the original "- [x]" only if all its parts are done. If it is truly impossible, change it to "- [!]" with a one-line reason.
6. git add -A and commit on the current branch with a clear message. Do not push. Do not touch other worktrees. Do not run git merge/rebase/reset.
One item only, then stop.
