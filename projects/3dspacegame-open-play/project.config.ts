// Loop 1: the "Open Play" mode of ~/Code/3dSpaceGameWT/3dSpaceGame (Rust, macroquad).
// The original hand-built scripts and specs are kept in reference/3dspacegame-open-play/ (the loop files themselves
// live in the game repo's ralph/ folder).
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "../../src/types.ts";

// In the Docker sandbox HOME is /home/ralph, but the folders are mounted at the host paths (RALPH_HOST_HOME).
const wt = join(process.env.RALPH_HOST_HOME ?? homedir(), "Code/3dSpaceGameWT");

const config: ProjectConfig = {
  repo: join(wt, "3dSpaceGame"),
  baseBranch: "main",
  loopDir: "ralph",
  rulesFile: "CLAUDE.md",
  // The loop was already past its skeleton round (rounds 1 to 18 ran with the original shell scripts).
  skeletonStep: false,
  commitTrailer: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>",
  // Every 2 rounds the loop pauses so the user can playtest. It goes on when `ralph continue` is run, or when
  // CONTINUE_TO_NEXT_ROUND=true is set in runs/<name>/control.env (for when the user is away). No time limit.
  limits: { maxRounds: 100, checkpointEvery: 4, checkpointWaitMinutes: 0 },

  // Run 1 reused the three existing worktrees.
  areas: {
    world: {
      owns: /^(src\/open_play\/(world|host|save)\/|src\/server\/|src\/bin\/|src\/shared\/net\/open_play\/)/,
      worktree: join(wt, "worktree-1"),
      branch: "work-1",
    },
    // Flight and interface may also extract plain-data functions in these shared folders so Open Play can reuse the
    // wave defense / Mine Liberation code (see the "Shared code reuse" section of ralph/CONTRACTS.md).
    flight: {
      owns: /^(src\/open_play\/flight\/|src\/shared\/(render|asteroids|weapons|audio|entities|game|scene|spheres|lighting|planet))/,
      worktree: join(wt, "worktree-2"),
      branch: "work-2",
    },
    interface: {
      owns: /^(src\/open_play\/interface\/|src\/shared\/(hud|app|menu|settings|key_bindings|ui))/,
      worktree: join(wt, "worktree-3"),
      branch: "work-3",
    },
  },
  integrationFiles:
    /^(src\/open_play\/mod\.rs|src\/open_play\/contracts\/|src\/lib\.rs|src\/main\.rs|src\/shared\/game\/mod\.rs|src\/shared\/menu\/modes\.rs|src\/shared\/net\/messages\/|CLAUDE\.md|README\.md|Cargo\.(toml|lock)|ralph\/(DECISIONS|CONTRACTS|PARITY)\.md)/,

  // Lesson from run 1: the full gate after every item (3 workers at once) pushed load to ~33 on a 12 GB box.
  itemCheck: "cargo fmt && cargo check && cargo test open_play::{{AREA}}",
  fullCheck: [
    "cargo fmt",
    "python3 scripts/check_spacing.py --fix",
    "cargo build 2>&1",
    "cargo test 2>&1",
    "cargo clippy --all-targets -- -D warnings 2>&1",
  ].join("\n"),
  qualityCmd: "codequality --full",
  env: { CARGO_BUILD_JOBS: "1" },

  // ralph-rust-cq = ralph-rust plus the `codequality` tool (built by `ralph docker build rust`).
  docker: { image: "ralph-rust-cq", cpus: 6, memory: "6500m", mounts: [wt] },
};

export default config;
