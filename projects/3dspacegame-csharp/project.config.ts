// Loop 4: port the Rust game (macroquad) to C# on Godot 4.6, in godot/ on the branch csharp-conversion.
// The loop never touches main: the base branch is csharp-conversion, in its own worktree folder (3dSpaceGame-cs) so it does not
// disturb the old features loop, which stays paused on main in 3dSpaceGame. Loop files live in csharp_ralph/.
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "../../src/types.ts";

// In the Docker sandbox HOME is /home/ralph, but the folders are mounted at the host paths (RALPH_HOST_HOME).
const hostHome = process.env.RALPH_HOST_HOME ?? homedir();
const wt = join(hostHome, "Code/3dSpaceGameWT");

const config: ProjectConfig = {
  repo: join(wt, "3dSpaceGame-cs"),
  baseBranch: "csharp-conversion",
  integrationBranch: "ralph/cs-integration",
  // One commit per round on csharp-conversion, not every item commit.
  squashRounds: true,
  loopDir: "csharp_ralph",
  rulesFile: "CLAUDE.md",
  skeletonStep: false,
  commitTrailer: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>",
  // Pauses every 2 rounds at first so the user can try the proof prototype; set checkpointEvery to 0 to run straight through.
  limits: { maxItemsPerRound: 12, maxRounds: 300, qualityEvery: 3, checkpointEvery: 0, checkpointWaitMinutes: 0 },

  areas: {
    core: {
      owns: /^(godot\/Core\/(?!Net\/)|godot\/Core\.Tests\/(?!Net\/)|csharp_ralph\/tasks\/core\.md)/,
      branch: "cs/core",
    },
    game: {
      owns: /^(godot\/Game\/(?!Net\/)|godot\/scripts\/(?!net_)|godot\/(PROOF|PARITY|README)\.md|godot\/screenshots\/|csharp_ralph\/tasks\/game\.md)/,
      branch: "cs/game",
    },
    net: {
      owns: /^(godot\/Core\/Net\/|godot\/Core\.Tests\/Net\/|godot\/Game\/Net\/|godot\/scripts\/net_|csharp_ralph\/tasks\/net\.md)/,
      branch: "cs/net",
    },
  },
  integrationFiles:
    /^(godot\/SpaceGame\.sln|godot\/Directory\.Build\.props|godot\/Core\/SpaceGame\.Core\.csproj|godot\/Core\.Tests\/SpaceGame\.Core\.Tests\.csproj|godot\/Game\/SpaceGame\.csproj|godot\/Game\/project\.godot|godot\/\.gitignore|CLAUDE\.md|csharp_ralph\/(DECISIONS|CONTRACTS)\.md)/,

  // Cheap check after every item; the full gate (all tests, headless start) in the quality pass and at merge time.
  itemCheck: "./godot/scripts/check_item.sh",
  fullCheck: "./godot/scripts/check_full.sh",
  qualityCmd: "",
  env: { DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", DOTNET_gcServer: "0", MSBUILDDISABLENODEREUSE: "1" },

  // ralph-godot = ralph-base + .NET 8 + Godot 4.6.3 mono + xvfb and software OpenGL (docker/Dockerfile.godot).
  docker: { image: "ralph-godot", cpus: 6, memory: "6g", mounts: [wt] },
};

export default config;
