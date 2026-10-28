import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "./log.ts";
import type { Project } from "./types.ts";

const POLL_MILLISECONDS = 10_000;
const MILLISECONDS_PER_MINUTE = 60_000;
const FLAG = "CONTINUE_TO_NEXT_ROUND";

export type CheckpointOutcome = "flag" | "continued" | "timed-out";

/** The control file the user edits while the loop runs: runs/<name>/control.env, lines like KEY=value. */
export const controlFile = (p: Project): string => join(p.runsDir, "control.env");
export const continueFile = (p: Project): string => join(p.stateDir, "CONTINUE");

/** Creates control.env with the flag off if it does not exist yet. */
export function ensureControlFile(p: Project): void {
  if (existsSync(controlFile(p))) return;

  writeFileSync(
    controlFile(p),
    `# Edit while the loop runs. It is read at every checkpoint (every ${p.limits.checkpointEvery || "no"} rounds).\n` +
      `# true  = do not wait at checkpoints, go straight on to the next round (set it when you are away)\n` +
      `# false = wait at each checkpoint so you can test (the loop goes on when you run: ralph continue ${p.name})\n` +
      `${FLAG}=false\n`,
  );
}

/** True when control.env says CONTINUE_TO_NEXT_ROUND=true. A missing or unreadable file means false. */
export function shouldContinueToNextRound(p: Project): boolean {
  if (!existsSync(controlFile(p))) return false;

  const line = readFileSync(controlFile(p), "utf8")
    .split("\n")
    .map((text) => text.trim())
    .find((text) => text.startsWith(`${FLAG}=`));

  return line?.slice(FLAG.length + 1).trim().toLowerCase() === "true";
}

/** Asks a loop that is waiting at a checkpoint to go on now, once (`ralph continue <name>`). */
export function requestContinue(p: Project): void {
  writeFileSync(continueFile(p), "");
}

/** At a checkpoint: go straight on when the flag is true, otherwise wait until the flag becomes true, `ralph continue`
 *  is run, or `minutes` pass (0 = no time limit). Polling and the clock can be replaced for tests. */
export async function waitAtCheckpoint(
  p: Project,
  minutes: number,
  pollMilliseconds = POLL_MILLISECONDS,
  now: () => number = Date.now,
): Promise<CheckpointOutcome> {
  ensureControlFile(p);

  if (shouldContinueToNextRound(p)) {
    log(p, "orchestrator", `CHECKPOINT: ${FLAG}=true, going straight on`);

    return "flag";
  }

  const deadline = minutes > 0 ? now() + minutes * MILLISECONDS_PER_MINUTE : Infinity;

  rmSync(continueFile(p), { force: true });
  log(p, "orchestrator", `CHECKPOINT: waiting. Test the game, then run: ralph continue ${p.name}  (or set ${FLAG}=true in ${controlFile(p)})`);

  while (now() < deadline) {
    if (shouldContinueToNextRound(p)) {
      log(p, "orchestrator", `CHECKPOINT: ${FLAG} is now true, going on`);

      return "flag";
    }

    if (existsSync(continueFile(p))) {
      rmSync(continueFile(p), { force: true });
      log(p, "orchestrator", "CHECKPOINT: continue requested");

      return "continued";
    }

    await new Promise((resolve) => setTimeout(resolve, pollMilliseconds));
  }

  log(p, "orchestrator", `CHECKPOINT: ${minutes} min passed, continuing on its own`);

  return "timed-out";
}
