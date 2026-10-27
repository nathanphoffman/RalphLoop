import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchOf, worktreeOf } from "./areas.ts";
import { ensureState } from "./log.ts";
import { commitIfDirty, git, gitOk } from "./shell.ts";
import type { Project } from "./types.ts";

/** Commits the loop folder to the base branch and creates or resets one worktree per area. Safe to repeat.
 *  Refuses to touch a worktree that has work not on the base branch. Returns the lines it printed. */
export function setup(p: Project): string[] {
  const out: string[] = [];
  const fail = (msg: string): never => {
    throw new Error(msg);
  };
  if (git(p.repo, "branch", "--show-current") !== p.baseBranch) fail(`${p.repo} is not on branch ${p.baseBranch}`);
  if (!existsSync(join(p.repo, p.loopDir, "SPEC.md"))) fail(`${p.repo}/${p.loopDir}/SPEC.md is missing (ralph init creates it)`);
  const other = git(p.repo, "status", "--porcelain")
    .split("\n")
    .filter((l) => l && !l.slice(3).startsWith(`${p.loopDir}/`));
  if (other.length) fail(`${p.repo} has other uncommitted changes, commit them first:\n${other.join("\n")}`);

  commitIfDirty(p, p.repo, `Add the Ralph loop files (${p.loopDir}/)`);
  git(p.repo, "worktree", "prune");
  for (const area of p.areas) {
    const dir = worktreeOf(p, area);
    const branch = branchOf(p, area);
    if (existsSync(dir)) {
      if (git(dir, "status", "--porcelain")) fail(`${dir} has uncommitted changes`);
      if (!gitOk(dir, "merge-base", "--is-ancestor", "HEAD", p.baseBranch)) fail(`${dir} has commits that are not on ${p.baseBranch}`);
      git(dir, "reset", "-q", "--hard", p.baseBranch);
    } else {
      mkdirSync(dirname(dir), { recursive: true });
      git(p.repo, "worktree", "add", "-q", "-B", branch, dir, p.baseBranch);
    }
    out.push(`${area}: ${dir} on ${branch} at ${git(dir, "rev-parse", "--short", "HEAD")}`);
  }
  ensureState(p);
  out.push(`Ready. State and logs: ${p.stateDir}`);
  return out;
}
