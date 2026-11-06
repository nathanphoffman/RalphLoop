// Loop 2: convert ~/Code/3dSpaceGameWT/3dSpaceGame from Rust to Deor (goal: 90% Deor, code quality 90).
// Loop files live in the game repo's deor_ralph/ folder (the old Open Play loop uses ralph/). Everything merges into the
// deor-conversion branch; main is never touched. Deor itself is not modified by this loop.
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "../../src/types.ts";

// In the Docker sandbox HOME is /home/ralph, but the folders are mounted at the host paths (RALPH_HOST_HOME).
const hostHome = process.env.RALPH_HOST_HOME ?? homedir();
const wt = join(hostHome, "Code/3dSpaceGameWT");

const config: ProjectConfig = {
  repo: join(wt, "3dSpaceGame"),
  baseBranch: "deor-conversion",
  // The old Open Play loop already owns ralph/integration in this repo.
  integrationBranch: "ralph/deor-integration",
  loopDir: "deor_ralph",
  rulesFile: "CLAUDE.md",
  // The helper library is milestone (a) in the first tasks; there is no separate skeleton round.
  skeletonStep: false,
  commitTrailer: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>",
  // Never pauses between rounds (checkpointEvery 0; control.env has CONTINUE_TO_NEXT_ROUND=true). Runs until the planner creates COMPLETE (Deor share >= 90 and codequality >= 90 and the checks green).
  limits: { groupItemsTarget: 2, maxItemsPerContext: 4, maxRounds: 200, qualityEvery: 4, checkpointEvery: 0, checkpointWaitMinutes: 0 },

  areas: {
    modes: {
      owns: /^(src\/(defense|dogfight|capture|flagship|mine|server|bin)\/|deor_ralph\/tasks\/modes\.md)/,
      branch: "deor/modes",
    },
    open_play: {
      owns: /^(src\/open_play\/|deor_ralph\/tasks\/open_play\.md)/,
      branch: "deor/open_play",
    },
    shared: {
      owns: /^(src\/shared\/|src\/lib\.rs|src\/main\.rs|scripts\/|tests\/|deor_ralph\/tasks\/shared\.md)/,
      branch: "deor/shared",
    },
  },
  integrationFiles:
    /^(src\/shared\/deor_lib\/|src\/shared\/deor_bridge\/|src\/shared\/game\/mod\.rs|src\/shared\/menu\/modes\.rs|src\/shared\/net\/messages\/|DEOR_CONVERSION\.md|CLAUDE\.md|README\.md|Cargo\.(toml|lock)|deor_ralph\/(DECISIONS|CONTRACTS|DEOR_BUGS)\.md)/,

  // Cheap check per item (three workers share the machine); the full gate runs in the quality pass, at merge time and
  // at the end of the round. Workers also run the tests of the module they touched.
  itemCheck: "sh scripts/build_deor.sh && cargo fmt && cargo check --all-targets",
  fullCheck: [
    "sh scripts/build_deor.sh",
    "cargo fmt",
    "python3 scripts/check_spacing.py --fix",
    "cargo test 2>&1",
    "cargo clippy --all-targets -- -D warnings 2>&1",
    "python3 scripts/check_reuse.py",
  ].join("\n"),
  // The Deor share and the code-quality score; the planner and the quality pass read both.
  qualityCmd: "python3 scripts/deor_share.py --by-folder; codequality --full",
  env: { CARGO_BUILD_JOBS: "2", RUST_TEST_THREADS: "2", DEOR_BIN: join(hostHome, ".deor/bin/deor") },

  // ralph-rust-cq = ralph-rust plus the `codequality` tool (built by `ralph docker build rust`). ~/.deor holds `deor`.
  docker: { image: "ralph-rust-cq", cpus: 3, memory: "7.5g", mounts: [wt, join(hostHome, ".deor")] },
};

export default config;
