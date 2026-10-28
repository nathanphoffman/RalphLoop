import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "./log.ts";
import type { Project } from "./types.ts";

const POLL_MILLISECONDS = 10_000;
const MILLISECONDS_PER_MINUTE = 60_000;

export type CheckpointOutcome = "continued" | "timed-out";

export const continueFile = (p: Project): string => join(p.stateDir, "CONTINUE");

/** Asks a loop that is waiting at a checkpoint to go on now (`ralph continue <name>`). */
export function requestContinue(p: Project): void {
  writeFileSync(continueFile(p), "");
}

/** Waits at a checkpoint for `ralph continue`, or until `minutes` pass, whichever comes first.
 *  The caller has already decided to wait (checkpointWaitMinutes > 0). Polling and the clock can be replaced for tests. */
export async function waitAtCheckpoint(
  p: Project,
  minutes: number,
  pollMilliseconds = POLL_MILLISECONDS,
  now: () => number = Date.now,
): Promise<CheckpointOutcome> {
  const deadline = now() + minutes * MILLISECONDS_PER_MINUTE;

  rmSync(continueFile(p), { force: true });
  log(p, "orchestrator", `CHECKPOINT: waiting up to ${minutes} min. Test the game now. Run: ralph continue ${p.name}`);

  while (now() < deadline) {
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
