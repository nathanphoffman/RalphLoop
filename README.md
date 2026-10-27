# RalphLoops

A generic engine for autonomous "Ralph loops": a shell loop that starts a fresh headless `claude -p` session per small task.
State lives in files (checklists, specs), not in the model's context, so sessions never drift or run out of room.
Point it at any git repo, describe the work in a few markdown files, and run it in a Docker sandbox.
First used for the Open Play mode of `~/Code/3dSpaceGameWT/3dSpaceGame` (kept as a worked example, see below).

## Quick start
```
ralph init mygame ~/Code/mygame world ui     # makes projects/mygame/project.conf and ~/Code/mygame/ralph/
# edit ~/Code/mygame/ralph/SPEC.md, CONTRACTS.md, tasks/*.md, and the checks in projects/mygame/project.conf
ralph dryrun                                 # whole loop on a toy repo with a fake claude, no tokens used
ralph docker build rust                      # once: sandbox image (ralph-base, plus ralph-rust)
ralph docker start mygame                    # run the loop in the sandbox
ralph status mygame | ralph log mygame -f | ralph report mygame | ralph docker stop mygame
```
Put `ralph` on your PATH (e.g. `ln -s ~/Code/RalphLoops/ralph ~/.local/bin/ralph`). `ralph start <name> --host` runs without
the sandbox and only starts if you pass `--host`, because it runs Claude with `--dangerously-skip-permissions` as you.

## How a loop works
- **Worker** (`engine/worker.sh <area>`), one per area, each in its own git worktree. While `tasks/<area>.md` has `- [ ]`:
  run `claude -p` on the first item, run the quick `ITEM_CHECK`, tick `- [x]`, commit. 3 failed tries marks it `- [!]` and
  moves on. Backs off on rate limits. Every few items a quality pass runs the full checks, fixes leftovers, and runs the optional quality command.
- **Orchestrator** (`engine/orchestrator.sh`): round 0 builds a compiling skeleton of the shared interfaces (optional). Then per round:
  workers in parallel, merge their branches on an `integration` branch (one `claude -p` session), run the full checks
  (fix sessions if red), a planning session writes `PROGRESS.md` and the next round's tasks from `SPEC.md`, then the base branch is
  fast-forwarded **only if the checks pass**, and the worktrees reset onto it. Stops when the planner creates `COMPLETE`
  (and the checks agree). One area also works; it is then just a worker loop with planning.

## What you write per project
In the target repo, `ralph/` (created by `ralph init`):
| File | Purpose |
|---|---|
| `SPEC.md` | what to build, ordered milestones, "Done means" |
| `CONTRACTS.md` | shared interfaces, which area owns which files, integration points, a "Requests" list for interface changes |
| `DECISIONS.md` | calls the loop made without asking; you override by editing it |
| `PROGRESS.md` | written by the planner each round |
| `tasks/<area>.md` | `- [ ]` open, `- [x]` done, `- [!]` blocked; each item sized for one session |

In this repo, `projects/<name>/project.conf` (annotated template: `templates/project/project.conf`): repo path, areas,
ownership regexes, `ITEM_CHECK` / `FULL_CHECK` / `QUALITY_CMD`, limits, Docker settings. To change a prompt for one project,
drop a same-named file in `projects/<name>/prompts/`; it wins over `engine/prompts/`.

## Layout
```
ralph                      the command
engine/                    lib.sh worker.sh orchestrator.sh setup.sh status.sh report.sh dryrun.sh fake-claude.sh prompts/
templates/                 loop/ (files copied into the repo), project/project.conf
projects/<name>/           one folder per loop (project.conf, optional prompts/)
docker/                    Dockerfile (ralph-base), Dockerfile.rust, run.sh
runs/<name>/               created at run time: state/ (ralph.log, items.tsv, COMPLETE), worktrees/, integration/ (git-ignored)
reference/                 the original hand-built 3dSpaceGame scripts, kept for comparison
```
State and logs live outside the target repo on purpose. Reporting: `ralph status` (items per area, round, ETA from measured
item times, last log lines), `ralph log`, `ralph report` (sessions per round, blocked items, ownership warnings, problems, decisions).

## Sandbox (Docker)
Workers run with `--dangerously-skip-permissions`, so a mistake could touch anything the user can. `ralph docker start` runs the whole loop in a container that:
- mounts only the repo, this checkout, `DOCKER_MOUNTS`, `~/.claude` (the login) and `~/.gitconfig` read-only, all at the **same absolute path** as the host (git worktrees store absolute paths)
- has no `~/.ssh` or git credentials, so nothing can push
- runs as your uid (files keep the right owner), drops all capabilities, no privilege escalation, CPU/memory/process limits (`DOCKER_CPUS`, `DOCKER_MEMORY`)

Tested: image builds, `claude` runs, and `ralph dryrun` passes inside the locked-down container.
Not yet tested: a real `claude` login from the mounted `~/.claude`, `ralph-rust` build, a real round. The network is open (Claude needs the API);
set `DOCKER_NETWORK` to use a custom network. `~/.claude` is writable inside the container, so treat the container as trusted with your Claude login.

## Lessons from the first loop (3dSpaceGame Open Play)
Config for it: `projects/3dspacegame-open-play/project.conf`.
- Pace: round 0 about 7 min; a round of 24 items (3 areas x 8) about 52 min; items about 5 min, merge+fix+plan about 11 min. Whole project estimated at 6 to 10 rounds.
- Claude usage was small (about 2% of the weekly Max limit in the first 1.5 hours). The bottleneck is the machine: 3 parallel cargo builds gave load average about 18 on a 12 GB box. Use `CARGO_BUILD_JOBS` and `NICE_LEVEL`.
- The full gate after every item drove load to about 33. So the engine default is a cheap `ITEM_CHECK` per item and the `FULL_CHECK` in the quality pass, the merge, and the end of the round. Tradeoff: a break is found up to 3 items later.
- Out-of-area edits happen mainly at integration points; the ownership log warns, never blocks.
- Never edit a running bash script in place (write `.new`, then `mv`). A running loop keeps its old logic until restarted; prompts are re-read for every session, so they apply immediately (keep them compatible).
- The first run merged straight into `main`, so `main` could be red mid-round. The engine now always merges on `ralph/integration` and fast-forwards only on green.
- A killed session loses only its in-progress item. `ralph stop` kills the whole process group, not just `tail`.

## Not done yet
- A real run of a second project through the Docker sandbox.
- The reference scripts are not converted to use the engine; `reference/` is history only.
