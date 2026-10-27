// Loop 1: the "Open Play" mode of ~/Code/3dSpaceGameWT/3dSpaceGame (Rust, macroquad).
// The original hand-built scripts and specs are kept in reference/3dspacegame-open-play/ (the loop files themselves
// live in the game repo's ralph/ folder).
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "../../src/types.ts";

const wt = join(homedir(), "Code/3dSpaceGameWT");

const config: ProjectConfig = {
  repo: join(wt, "3dSpaceGame"),
  baseBranch: "main",
  loopDir: "ralph",
  rulesFile: "CLAUDE.md",

  // Run 1 reused the three existing worktrees.
  areas: {
    world: {
      owns: /^(src\/open_play\/(world|host|save)\/|src\/server\/|src\/bin\/|src\/shared\/net\/open_play\/)/,
      worktree: join(wt, "worktree-1"),
      branch: "work-1",
    },
    flight: { owns: /^src\/open_play\/flight\//, worktree: join(wt, "worktree-2"), branch: "work-2" },
    interface: { owns: /^src\/open_play\/interface\//, worktree: join(wt, "worktree-3"), branch: "work-3" },
  },
  integrationFiles:
    /^(src\/open_play\/mod\.rs|src\/open_play\/contracts\/|src\/lib\.rs|src\/main\.rs|src\/shared\/game\/mod\.rs|src\/shared\/menu\/modes\.rs|src\/shared\/net\/messages\/|CLAUDE\.md|README\.md|Cargo\.(toml|lock))/,

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
  env: { CARGO_BUILD_JOBS: "3" },

  docker: { image: "ralph-rust", cpus: 6, memory: "9g", mounts: [wt] },
};

export default config;
