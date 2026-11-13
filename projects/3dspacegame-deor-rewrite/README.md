# 3dspacegame-deor-rewrite: how to run it

Goal: Deor share of at least 90% (now 78.6%) in `~/Code/3dSpaceGameWT/3dSpaceGame-deor`, branch `deor-rewrite`.
Each item converts hand-written Rust to Deor and deletes that Rust in the same commit.

## Budget (set in `project.config.ts`)
- 12 CPUs and 8 GB for the container (`docker.cpus`, `docker.memory`).
- 2 cargo build pipelines (`buildPipelines: 2`), 6 threads each (`CARGO_BUILD_JOBS: "6"`). `bin/cargo` hands out two lock slots, so a
  third cargo waits for a free one. Each pipeline builds the whole game crate; watch memory (`free -g`) on the first round.
- If builds get killed for memory, set `buildPipelines: 1` and `CARGO_BUILD_JOBS: "12"`.

## Run it
```
cd ~/Code/RalphLoops
ralph docker build rust            # once, if the ralph-rust-cq image is missing
ralph docker start 3dspacegame-deor-rewrite
ralph watch 3dspacegame-deor-rewrite
ralph stop 3dspacegame-deor-rewrite   # when done
```
Pause after a round: `touch runs/3dspacegame-deor-rewrite/state/PAUSE`, then `ralph continue 3dspacegame-deor-rewrite`.
The repo must be on `deor-rewrite` and clean before starting.

## What the loop reads
- Task list: `docs/deor_rewrite/tasks/open_play.md` ("Next up", F1 to F6). Plan and numbers log: `NEW_PLAN.md`.
- Rules for workers: `prompts/worker.md` here, plus the repo's `CLAUDE.md`. Edit the task list while it runs; prompts are re-read per session.
- Per item: `sh scripts/build_deor.sh && cargo fmt && cargo check --all-targets`. Full gate (build, test, clippy, reuse, share) runs in the quality pass, at merge and at round end.

## Checks to do yourself afterwards
Tests do not cover play. Fly a ship: surface turrets, mining and pickups, a full flight, a station visit.
