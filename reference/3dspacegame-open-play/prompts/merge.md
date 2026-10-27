[ralph:merge round={{ROUND}}]
You are the merge step of an autonomous build loop. Never ask questions; log assumptions in ralph/DECISIONS.md.
Working directory is a checkout of the main repo on the current branch (main or integration), clean.

Merge these branches into the current branch ONE AT A TIME, in this order: {{BRANCHES}}.
For each branch:
1. `git merge --no-ff <branch>` (message "Merge <branch> (round {{ROUND}})"). If there are conflicts, resolve them. At integration points (src/open_play/mod.rs, shared menu/mode/message lists, CLAUDE.md, README.md) keep BOTH sides. For other files, keep the intent of both branches.
2. Run the CLAUDE.md checks: cargo fmt; python3 scripts/check_spacing.py --fix; cargo build (no warnings); cargo test; cargo clippy (no warnings). Fix whatever the merge broke with the smallest change (commit it "Fix after merging <branch>"). Do not delete another area's work to make something pass; fix the glue.
3. Apply any lines under "Requests" in ralph/CONTRACTS.md that this branch added: edit src/open_play/contracts/ (additive only), then clear the request line and note it in ralph/DECISIONS.md.
If a branch cannot be merged cleanly after a real attempt, `git merge --abort`, note the branch and the reason in ralph/PROGRESS.md and continue with the next one.
End with the current branch building cleanly and everything committed.
