# 3dspacegame-supernova-run: how to run it

Goal: rebuild Open Play as the Supernova Run in `~/Code/3dSpaceGameWT/3dSpaceGame-supernova`, branch `supernova-run` (cut from
`main` at `30f4da4e7`). The plan is `docs/deor_rewrite/PLAN.md` in that repo (section 1: the design and phases 0 to 7; section 5:
the carried-over bug fixes and features). The old Open Play is the pushed branch `open-play-backup`.

## The Deor rule
The Deor share (`python3 scripts/deor_share.py`, `rust` blocks count as Rust) must stay at 80% or more; the aim is 85%. Rust is a last
resort (a thin engine wrapper or a measured performance need). Enforced in three places:
- Every prompt says so (`prompts/worker.md`, `plan.md`, `quality.md`).
- The full check runs `deor_share.py --min-share 80`, so a round under 80% is red: the fix session tries to raise it, and if it
  cannot, the loop stops with exit code 4 and the base branch is not moved.
- A worker that cannot keep the share marks its item `- [!] DEOR SHARE`; the planner then writes `STOPPED_DEOR_SHARE.md` and no
  open items, and the loop stops ("planner stalled").
Start: 81.5%. Phase 1 removes Rust glue, so the share should rise toward 85%.

## Budget (set in `project.config.ts`)
- 6.5 GB of RAM for the container (`docker.memory: "6500m"`), 6 CPUs (`docker.cpus`).
- One cargo build at a time (`buildPipelines: 1`) with 6 threads (`CARGO_BUILD_JOBS: "6"`, `RUST_TEST_THREADS: "6"`). `bin/cargo` takes a file lock.
- One worker area (`supernova`): the phases are in order, so nothing runs in parallel.
- The loop never pauses (`checkpointEvery: 0`, `maxRounds: 200`). To stop after a round anyway: `touch runs/3dspacegame-supernova-run/state/PAUSE`, then `ralph continue 3dspacegame-supernova-run`.

## Run it
```
cd ~/Code/RalphLoops
ralph docker build rust                         # once, if the ralph-rust-cq image is missing
ralph setup 3dspacegame-supernova-run           # done once: commits the loop files, creates the worktree
ralph docker start 3dspacegame-supernova-run
ralph watch 3dspacegame-supernova-run
ralph stop 3dspacegame-supernova-run            # when done
```
The repo (`3dSpaceGame-supernova`) must be on `supernova-run` and clean before starting. The loop never pushes and never touches `main`; merge `supernova-run` yourself when you are happy.

## What the loop reads
- Task list: `docs/deor_rewrite/tasks/supernova.md` (the planner rewrites it every round from PLAN.md). Spec and checklist: `SPEC.md` (edit the live copy in `runs/3dspacegame-supernova-run/SPEC.md` while it runs, no commit needed).
- Rules for workers: `prompts/worker.md` here, plus the repo's `CLAUDE.md`. Prompts are re-read per session.
- Per item: `sh scripts/build_deor.sh && cargo fmt && cargo check --all-targets`. The full gate (the same steps as `just check`, plus the share floor) runs in the quality pass, at merge and at the end of each round.

## Not in this loop
The Deor test wiring (PLAN.md section 4, T2 and T3) needs your choice. Tuning by feel (zones per planet, run length, prices, cruise speed) uses the defaults in PLAN.md; the planner lists them under "To tune by playing" in PROGRESS.md.
