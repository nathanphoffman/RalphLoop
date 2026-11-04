// Loop 3: new features for ~/Code/3dSpaceGameWT/3dSpaceGame (Rust, macroquad), taken from the user's todo.md.
// Loop files live in the game repo's features_ralph/ folder (ralph/ is the old Open Play loop, deor_ralph/ the Deor one).
// Everything merges on ralph/features-integration and is fast-forwarded into main only when the full checks pass.
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "../../src/types.ts";

// In the Docker sandbox HOME is /home/ralph, but the folders are mounted at the host paths (RALPH_HOST_HOME).
const hostHome = process.env.RALPH_HOST_HOME ?? homedir();
const wt = join(hostHome, "Code/3dSpaceGameWT");

const config: ProjectConfig = {
  repo: join(wt, "3dSpaceGame"),
  baseBranch: "main",
  // The Open Play loop owns ralph/integration and the Deor loop owns ralph/deor-integration.
  integrationBranch: "ralph/features-integration",
  // One commit per round on main, not every item commit.
  squashRounds: true,
  loopDir: "features_ralph",
  rulesFile: "CLAUDE.md",
  // The repo already has all its structure; features are added straight into it.
  skeletonStep: false,
  commitTrailer: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>",
  // Never pauses between rounds (checkpointEvery 0). Runs until the planner creates COMPLETE or maxRounds is reached.
  limits: { maxItemsPerRound: 12, maxRounds: 200, qualityEvery: 3, checkpointEvery: 0, checkpointWaitMinutes: 0 },

  areas: {
    modes: {
      owns: /^(src\/(defense|dogfight|capture|flagship|mine|server|bin)\/|features_ralph\/tasks\/modes\.md)/,
      branch: "features/modes",
    },
    open_play: {
      owns: /^(src\/open_play\/|features_ralph\/tasks\/open_play\.md)/,
      branch: "features/open_play",
    },
    shared: {
      owns: /^(src\/shared\/|src\/lib\.rs|src\/main\.rs|scripts\/|tests\/|features_ralph\/tasks\/shared\.md)/,
      branch: "features/shared",
    },
  },
  integrationFiles:
    /^(src\/shared\/game\/mod\.rs|src\/shared\/menu\/modes\.rs|src\/shared\/net\/messages\/|src\/shared\/consts\.rs|CLAUDE\.md|README\.md|Cargo\.(toml|lock)|features_ralph\/(DECISIONS|CONTRACTS)\.md)/,

  // Same cheap-per-item, full-gate-later split as the other 3dspacegame loops.
  itemCheck: "cargo fmt && cargo check --all-targets",
  fullCheck: [
    "cargo fmt",
    "python3 scripts/check_spacing.py --fix",
    "cargo build 2>&1",
    "cargo test 2>&1",
    "cargo clippy --all-targets -- -D warnings 2>&1",
    "python3 scripts/check_reuse.py",
  ].join("\n"),
  qualityCmd: "codequality --full",
  env: { CARGO_BUILD_JOBS: "1", RUST_TEST_THREADS: "2" },

  // ralph-rust-cq = ralph-rust plus the `codequality` tool (built by `ralph docker build rust`).
  docker: { image: "ralph-rust-cq", cpus: 3, memory: "6g", mounts: [wt] },
};

export default config;
