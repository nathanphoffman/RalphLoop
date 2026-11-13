// Loop 5: rewrite ~/Code/3dSpaceGameWT/3dSpaceGame around Deor (goal: Deor share of at least 90%, where `rust` blocks inside
// .deor files count as Rust), following docs/deor_rewrite/NEW_PLAN.md (the "Takeover plan" section: phases C and D first). The base branch is deor-rewrite (cut from deor-conversion), checked out in its own worktree
// folder (3dSpaceGame-deor) so the features loop's checkout on main is not disturbed. Loop files live in docs/deor_rewrite/.
// Budget: 12 threads and 8 GB for the container. buildLock routes every cargo call (the checks' and Claude's) through
// bin/cargo, which takes a file lock; buildPipelines: 2 lets two cargo commands run at once, 6 threads each. Deor itself is never modified by this loop.
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "../../src/types.ts";

// In the Docker sandbox HOME is /home/ralph, but the folders are mounted at the host paths (RALPH_HOST_HOME).
const hostHome = process.env.RALPH_HOST_HOME ?? homedir();
const wt = join(hostHome, "Code/3dSpaceGameWT");

const config: ProjectConfig = {
  repo: join(wt, "3dSpaceGame-deor"),
  baseBranch: "deor-rewrite",
  // ralph/integration, ralph/deor-integration, ralph/features-integration and ralph/cs-integration belong to the other loops.
  integrationBranch: "ralph/deor-rewrite-integration",
  // Item commits are kept on the base branch (no squash): a rewrite needs a bisectable history.
  squashRounds: false,
  loopDir: "docs/deor_rewrite",
  rulesFile: "CLAUDE.md",
  // The repo has all its structure; Phase 0 of PLAN.md is the first task list, there is no skeleton round.
  skeletonStep: false,
  claudeModel: "claude-sonnet-5-5",
  commitTrailer: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>",
  // Never pauses (checkpointEvery 0). To pause after a round, create runs/3dspacegame-deor-rewrite/state/PAUSE; the
  // loop then waits for `ralph continue`. Items are big (one folder set per area per round, 1,000+ Rust lines with
  // callers), so one session may take up to two hours, a round has five sessions per area, and a gate up to 45 minutes.
  limits: {
    itemTimeout: 7200,
    minItemSeconds: 2400, // a session under 40 minutes that did not tick its item is sent back to it
    maxEarlyRetries: 3,
    gateTimeout: 2700,
    groupItemsTarget: 2,
    maxItemsPerContext: 4,
    maxItemsPerRound: 5,
    qualityEvery: 4,
    maxRounds: 20, // phases C and D are about 12 items; review after every few rounds, then raise it
    checkpointEvery: 0,
    checkpointWaitMinutes: 0,
  },

  // One area for now: the takeover plan's phases C and D are all Open Play. It owns all of src/ and the scripts because
  // converting a type means editing its users in other folders (shared/, net/); the worker prompt still limits that to
  // mechanical edits. Add a `core` area again for the Phase E leftovers (shared/game, server/, HUD) when they are listed.
  areas: {
    open_play: {
      owns: /^(src\/|scripts\/|tests\/|docs\/deor_rewrite\/tasks\/open_play\.md)/,
      branch: "rewrite/open_play",
    },
  },
  // Shared files every area may touch (append-only, see CONTRACTS.md).
  integrationFiles:
    /^(src\/game\.deor|src\/game_generated\.rs|src\/engine\/prelude_wrappers\.deor|src\/shared\/types\/|scripts\/build_deor\.sh|scripts\/shared_deor_items\.txt|src\/lib\.rs|CLAUDE\.md|README\.md|DEOR_CONVERSION\.md|Cargo\.(toml|lock)|docs\/deor_rewrite\/(DECISIONS|CONTRACTS|DEOR_BUGS|ENUMS|PORT_NOTES|DO_NOT_PORT|PROGRESS|BUGS|NEW_PLAN|assumptions)\.md)/,

  // Cheap check per item; the full gate runs in the quality pass, at merge time and at the end of the round.
  // Workers also run the tests of the modules they touched (prompts/worker.md).
  itemCheck: "sh scripts/build_deor.sh && cargo fmt && cargo check --all-targets",
  fullCheck: [
    "sh scripts/build_deor.sh",
    "cargo fmt",
    "python3 scripts/check_spacing.py --fix",
    "cargo build 2>&1",
    "cargo test 2>&1",
    "cargo clippy --all-targets -- -D warnings 2>&1",
    "python3 scripts/check_reuse.py",
    // check_spelling.py lives on main only; Phase 6 ports it (PLAN 11, ah) and adds it here.
    "python3 scripts/deor_share.py",
  ].join("\n"),
  // The Deor share by folder and the code-quality score; the planner and the quality pass read both.
  qualityCmd: "python3 scripts/deor_share.py --by-folder; codequality --full",
  // One build pipeline (buildLock) with all 6 threads. DEOR_BIN points at the host's deor binary (mounted at the same path).
  buildLock: true,
  buildPipelines: 2,
  // Every other round, drop the game's incremental build cache in each checkout (8+ GB per worktree otherwise); the
  // compiled dependencies stay, so the next build costs one full compile of the crate (a few minutes).
  cleanup: { everyRounds: 2, cmd: "cargo clean -p space_shooter" },
  env: { CARGO_BUILD_JOBS: "6", RUST_TEST_THREADS: "6", DEOR_BIN: join(hostHome, ".deor/bin/deor") },

  // ralph-rust-cq = ralph-rust plus the `codequality` tool (built by `ralph docker build rust`). ~/.deor holds `deor`.
  docker: { image: "ralph-rust-cq", cpus: 12, memory: "8g", mounts: [wt, join(hostHome, ".deor")] },
};

export default config;
