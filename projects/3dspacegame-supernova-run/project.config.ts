// Loop 6: rebuild Open Play as the "Supernova Run" in ~/Code/3dSpaceGameWT/3dSpaceGame (the Deor game): one system (Sol),
// one simple ship with wave defense's cockpit, zones with point multipliers, a shared timer to a supernova, permanent
// upgrades, shared multiplayer and flagship, plus the carried-over bug fixes and features. The plan is PLAN.md
// (sections 1 and 5) in docs/deor_rewrite/. The base branch is supernova-run (cut from main), checked out in its own worktree
// folder (3dSpaceGame-supernova) so the other checkouts are not disturbed. The old Open Play is the pushed branch open-play-backup.
//
// Budget: 6.5 GB of RAM for the container, ONE cargo build at a time, 6 threads. buildLock routes every cargo call (the
// checks' and Claude's) through bin/cargo, which takes a file lock; buildPipelines: 1 means one cargo at a time with all 6 threads.
// One area (one worker): the phases are sequential, and a second worker would need a second build.
//
// The loop NEVER pauses on its own (checkpointEvery 0). It runs until the planner creates COMPLETE, or it stops itself:
//  - the Deor share has to stay at 80% or more (the full check fails below that; the fix session tries to raise it; if it
//    cannot, the round is red and the loop stops with exit code 4), and the planner stops the run when it records that the
//    share cannot be kept (see prompts/plan.md). Aim for 85%.
//  - maxRounds is a high safety limit.
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "../../src/types.ts";

// In the Docker sandbox HOME is /home/ralph, but the folders are mounted at the host paths (RALPH_HOST_HOME).
const hostHome = process.env.RALPH_HOST_HOME ?? homedir();
const wt = join(hostHome, "Code/3dSpaceGameWT");

const config: ProjectConfig = {
  repo: join(wt, "3dSpaceGame-supernova"),
  baseBranch: "supernova-run",
  // Every other loop has its own integration branch; this one is its own.
  integrationBranch: "ralph/supernova-run-integration",
  // Item commits are kept on the base branch (no squash): a big rebuild needs a bisectable history.
  squashRounds: false,
  loopDir: "docs/deor_rewrite",
  rulesFile: "CLAUDE.md",
  // The repo has all its structure and PLAN.md is the first plan, so there is no skeleton round.
  skeletonStep: false,
  claudeModel: "claude-sonnet-5-5",
  commitTrailer: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>",
  // Never pauses: checkpointEvery 0 and no wait. (To stop after a round anyway, create runs/3dspacegame-supernova-run/state/PAUSE.)
  limits: {
    itemTimeout: 7200,
    minItemSeconds: 1200, // a session under 20 minutes that did not tick its item is sent back to it
    maxEarlyRetries: 3,
    gateTimeout: 2700,
    groupItemsTarget: 2,
    maxItemsPerContext: 4,
    maxItemsPerRound: 6,
    qualityEvery: 4,
    maxRounds: 200,
    checkpointEvery: 0,
    checkpointWaitMinutes: 0,
  },

  // One area owns the whole game: removing Open Play's old parts and building the new ones touch src/, the scripts, the
  // tests and the docs together. Phases are in order, so there is nothing to run in parallel.
  areas: {
    supernova: {
      owns: /^(src\/|scripts\/|tests\/|assets\/|docs\/deor_rewrite\/tasks\/supernova\.md)/,
      branch: "supernova/work",
    },
  },
  // Shared files anyone may touch (append-only, see CONTRACTS.md).
  integrationFiles:
    /^(src\/game\.deor|src\/game_generated\.rs|src\/engine\/prelude_wrappers\.deor|src\/lib\.rs|CLAUDE\.md|README\.md|\.gitignore|Cargo\.(toml|lock)|docs\/deor_rewrite\/(PLAN|DECISIONS|CONTRACTS|PROGRESS)\.md)/,

  // Cheap check per item; the full gate runs in the quality pass, at merge time and at the end of the round.
  // Workers also run the tests of the modules they touched (prompts/worker.md).
  itemCheck: "sh scripts/build_deor.sh && cargo fmt && cargo check --all-targets",
  // The same list as `just check` (the container has no `just`), plus the Deor share floor: below 80% the gate fails.
  fullCheck: [
    "sh scripts/build_deor.sh",
    "cargo fmt",
    "python3 scripts/check_spacing.py --fix",
    "cargo build 2>&1",
    "cargo test 2>&1",
    '"${DEOR_BIN:-deor}" test src',
    "cargo clippy --all-targets -- -D warnings 2>&1",
    "python3 scripts/check_reuse.py",
    "DEOR_LIB=lib python3 scripts/check_deor_names.py src/game.deor",
    "python3 scripts/check_spelling.py",
    "python3 scripts/deor_share.py --min-share 80",
  ].join("\n"),
  // The Deor share by folder and the code-quality score; the planner and the quality pass read both.
  qualityCmd: "python3 scripts/deor_share.py --by-folder; codequality --full",
  // One build pipeline (buildLock) with all 6 threads. DEOR_BIN points at the host's deor binary (mounted at the same path).
  buildLock: true,
  buildPipelines: 1,
  // Every other round, drop the game's incremental build cache in each checkout (8+ GB per worktree otherwise); the
  // compiled dependencies stay, so the next build costs one full compile of the crate (a few minutes).
  cleanup: { everyRounds: 2, cmd: "cargo clean -p space_shooter" },
  env: { CARGO_BUILD_JOBS: "6", RUST_TEST_THREADS: "6", DEOR_BIN: join(hostHome, ".deor/bin/deor") },

  // ralph-rust-cq = ralph-rust plus the `codequality` tool (built by `ralph docker build rust`). ~/.deor holds `deor`.
  docker: { image: "ralph-rust-cq", cpus: 6, memory: "6500m", mounts: [wt, join(hostHome, ".deor")] },
};

export default config;
