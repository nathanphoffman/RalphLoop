import { appendLogFile, log } from "./log.ts";
import { runLimited } from "./shell.ts";
import type { Project } from "./types.ts";

const RATE_LIMIT = /rate.?limit|429|overloaded|usage limit|too many requests|try again later|quota|capacity/i;
const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));

export interface ClaudeSession {
  id: string; // a UUID the caller keeps, so a later call can resume this conversation
  resume: boolean; // false: start the conversation with this id; true: continue it
}

/** One headless Claude session in <dir>. Output is appended to logs/<logName>. Backs off on rate-limit errors. */
export async function runClaude(
  p: Project,
  dir: string,
  prompt: string,
  logName: string,
  tag = "claude",
  session?: ClaudeSession,
): Promise<number> {
  const [bin, ...lead] = p.claudeCmd;
  const args = [...lead, "-p", prompt, "--dangerously-skip-permissions"];
  if (session) args.push(session.resume ? "--resume" : "--session-id", session.id);
  if (p.claudeModel) args.push("--model", p.claudeModel);
  let delay = p.limits.backoffStart;
  for (let tries = 0; ; ) {
    const { status, output } = await runLimited(p, [bin!, ...args], { cwd: dir, timeoutSec: p.limits.itemTimeout });
    appendLogFile(p, logName, output);
    if (status !== 0 && RATE_LIMIT.test(output) && tries < p.limits.maxRateRetries) {
      tries++;
      log(p, tag, `rate limited (try ${tries}), sleeping ${delay}s`);
      await sleep(delay);
      delay = Math.min(delay * 2, p.limits.backoffMax);
      continue;
    }
    return status;
  }
}
