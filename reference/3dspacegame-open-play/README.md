# Ralph loop for Open Play

- `SPEC.md` what to build. `CONTRACTS.md` shared types and file ownership. `DECISIONS.md` calls made without asking. `PROGRESS.md` per-round status.
- `tasks/<area>.md` checklists (`world`=worktree-1, `flight`=worktree-2, `interface`=worktree-3). `- [ ]` open, `- [x]` done, `- [!]` blocked.
- `start.sh` once: commits `ralph/` to main, puts the worktrees on main.
- `orchestrator.sh` the loop (round 0 skeleton, then workers -> merge -> checks -> plan -> sync). Run: `nohup ralph/orchestrator.sh >/dev/null 2>&1 &`
- `worker.sh <area>` started by the orchestrator, one Claude session per checklist item, backs off on rate limits.
- `dryrun.sh [dir]` runs the whole loop in a throwaway clone with a fake `claude` and no cargo.
- State and logs: `../.ralph/` (`ralph.log`, `logs/`, `violations.log`, `COMPLETE`). Stop early: `pkill -f orchestrator.sh; pkill -f worker.sh`.
- Knobs (env): `RALPH_MAX_ROUNDS` (30), `ITEM_TIMEOUT` (2700s), `MAX_ITEM_FAILS` (3), `BACKOFF_START/MAX`.
