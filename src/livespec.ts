import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, gitOk } from "./shell.ts";
import type { Project } from "./types.ts";

/** The spec you edit while the loop runs: runs/<project>/SPEC.md. It lives outside the game repo, so editing it needs no commit. */
export const liveSpecFile = (p: Project): string => join(p.runsDir, "SPEC.md");

/** Creates the live spec from the repo's committed one the first time, so there is something to edit. */
export function seedLiveSpec(p: Project): void {
  const committed = join(p.repo, p.loopDir, "SPEC.md");
  if (!existsSync(liveSpecFile(p)) && existsSync(committed)) copyFileSync(committed, liveSpecFile(p));
}

/** Copies the live spec into <checkout>'s loop folder and commits just that file there. True if it changed.
 *  Call it on the integration checkout before the planner runs: the planner then plans from the new spec, the round
 *  lands on the base branch with it, and the workers see it from the next round on. */
export function syncLiveSpec(p: Project, checkout: string): boolean {
  const live = liveSpecFile(p);
  const target = join(checkout, p.loopDir, "SPEC.md");

  if (!existsSync(live)) return false;
  if (existsSync(target) && readFileSync(target, "utf8") === readFileSync(live, "utf8")) return false;

  writeFileSync(target, readFileSync(live));
  git(checkout, "add", join(p.loopDir, "SPEC.md"));
  if (gitOk(checkout, "diff", "--cached", "--quiet")) return false;

  git(checkout, "commit", "-q", "-m", `ralph: SPEC.md updated from the live file\n\n${p.commitTrailer}`);
  return true;
}
