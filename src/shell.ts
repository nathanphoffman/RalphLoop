import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import type { Project } from "./types.ts";

export interface RunResult {
  status: number;
  output: string;
}

/** Child processes started by the engine, so a stop signal can kill them. */
export const children = new Set<ChildProcess>();

export function killChildren(): void {
  for (const child of children) child.kill("SIGTERM");
}

/** Run a command at low priority with a time limit; output is stdout+stderr together. Never throws. */
export function runLimited(
  p: Project,
  cmd: string[],
  opts: { cwd: string; timeoutSec: number },
): Promise<RunResult> {
  const full = ["nice", "-n", String(p.limits.niceLevel), "timeout", String(opts.timeoutSec), ...cmd];
  return new Promise((resolve) => {
    const child = spawn(full[0]!, full.slice(1), {
      cwd: opts.cwd,
      env: { ...process.env, ...p.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.add(child);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => chunks.push(c));
    child.on("error", (err) => {
      children.delete(child);
      resolve({ status: 127, output: String(err) });
    });
    child.on("close", (code, signal) => {
      children.delete(child);
      resolve({ status: code ?? (signal ? 128 : 1), output: Buffer.concat(chunks).toString() });
    });
  });
}

/** git in <dir>; returns trimmed stdout, throws on failure. */
export function git(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** git in <dir>; true when it exits 0. */
export function gitOk(dir: string, ...args: string[]): boolean {
  return spawnSync("git", ["-C", dir, ...args], { stdio: "ignore" }).status === 0;
}

export function commitIfDirty(p: Project, dir: string, message: string): void {
  git(dir, "add", "-A");
  if (!gitOk(dir, "diff", "--cached", "--quiet")) git(dir, "commit", "-q", "-m", `${message}\n\n${p.commitTrailer}`);
}

export function resetClean(dir: string): void {
  git(dir, "reset", "-q", "--hard", "HEAD");
  git(dir, "clean", "-qfd");
}
