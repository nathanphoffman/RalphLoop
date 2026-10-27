[ralph:quality area={{AREA}}]
You are the code-quality pass of an autonomous build loop, run between features. Never ask questions; log judgement calls in ralph/DECISIONS.md ("[round {{ROUND}}, {{AREA}}] ...").

1. Run `codequality --full` in this worktree and read the report.
2. Only act on findings in files your area owns (see ownership in ralph/CONTRACTS.md; for {{AREA}} that is its src/open_play/ folders). Ignore findings in other areas' files and in older base-game code.
3. For each finding, carry out the recommendation if it makes sense and is easy enough: small renames, splitting a long function or file, extracting a named constant, removing duplication, missing comments. Skip anything risky, large, or that would change behaviour; note skipped ones in one line each in ralph/DECISIONS.md.
4. If the feedback shows a pattern worth keeping (a rule you keep breaking, a helper you should reuse), update the code and, if it is a real project convention, add one short line to CLAUDE.md.
5. No behaviour changes. Re-run the CLAUDE.md checks (cargo fmt; python3 scripts/check_spacing.py --fix; cargo build with no warnings; cargo test; cargo clippy) until clean, then run `codequality --full` again and confirm the score did not get worse.
6. git add -A and commit "ralph({{AREA}}): code quality pass". Do not touch the task checklist. Stop.
