import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { worktreeOf } from "./areas.ts";
import { HOME } from "./config.ts";
import type { Project } from "./types.ts";

// The sandbox. Mounts only: the project repo, this checkout (engine + runs/), the project's extra mounts, ~/.claude
// (the Claude login) and ~/.gitconfig (read-only). All at the SAME absolute path as on the host, because git worktrees
// store absolute paths. Deliberately NOT mounted: ~/.ssh and git credential helpers, so nothing can push.
// The container drops all Linux capabilities, cannot gain privileges, and is limited in CPU, memory and processes.

const docker = (args: string[]): number => spawnSync("docker", args, { stdio: "inherit" }).status ?? 1;

export function dockerBuild(rust: boolean): number {
  const dir = join(HOME, "docker");
  const status = docker(["build", "-t", "ralph-base", "--build-arg", `HOST_UID=${process.getuid?.() ?? 1000}`, "--build-arg", `HOST_GID=${process.getgid?.() ?? 1000}`, dir]);
  if (status !== 0 || !rust) return status;
  return docker(["build", "-t", "ralph-rust", "-f", join(dir, "Dockerfile.rust"), dir]);
}

export function dockerStop(p: Project): number {
  return docker(["stop", `ralph-${p.name}`]);
}

function runArgs(p: Project): string[] {
  const home = homedir();
  mkdirSync(p.runsDir, { recursive: true });
  if (!existsSync(join(home, ".claude.json"))) writeFileSync(join(home, ".claude.json"), "{}");
  const mount = (from: string, to = from, ro = false) => ["-v", `${from}:${to}${ro ? ":ro" : ""}`];
  const worktreeParents = p.areas.filter((a) => p.config.areas[a]?.worktree).map((a) => dirname(worktreeOf(p, a)));
  return [
    "--rm", "--name", `ralph-${p.name}`, "--user", `${process.getuid?.()}:${process.getgid?.()}`,
    `--cpus=${p.docker.cpus}`, `--memory=${p.docker.memory}`, "--pids-limit=4096",
    "--cap-drop=ALL", "--security-opt=no-new-privileges",
    "-e", "HOME=/home/ralph", "-e", "GIT_CONFIG_COUNT=1", "-e", "GIT_CONFIG_KEY_0=safe.directory", "-e", "GIT_CONFIG_VALUE_0=*",
    ...(p.docker.network ? ["--network", p.docker.network] : []),
    ...mount(p.repo), ...mount(HOME),
    ...mount(join(home, ".claude"), "/home/ralph/.claude"),
    ...mount(join(home, ".claude.json"), "/home/ralph/.claude.json"),
    ...(existsSync(join(home, ".gitconfig")) ? mount(join(home, ".gitconfig"), "/home/ralph/.gitconfig", true) : []),
    ...[...p.docker.mounts, ...worktreeParents].flatMap((m) => mount(m)),
  ];
}

export function dockerStart(p: Project): number {
  const status = docker(["run", "-d", ...runArgs(p), "-w", HOME, p.docker.image, join(HOME, "ralph"), "run", p.name]);
  if (status === 0) console.log(`started ralph-${p.name} in Docker. Watch: ralph log ${p.name} -f   Stop: ralph docker stop ${p.name}`);
  return status;
}

export function dockerShell(p: Project): number {
  return docker(["run", "-it", ...runArgs(p), "-w", p.repo, p.docker.image, "bash"]);
}
