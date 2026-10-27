import { runLimited } from "./shell.ts";
import type { Project } from "./types.ts";

export interface CheckResult {
  ok: boolean;
  output: string; // last 60 lines
}

/** Run a check command with `bash -e` in <dir>. An empty command (or RALPH_SKIP_GATE) always passes. */
export async function runCheck(p: Project, dir: string, command: string): Promise<CheckResult> {
  if (p.skipGate || !command) return { ok: true, output: "" };
  const { status, output } = await runLimited(p, ["bash", "-ec", command], { cwd: dir, timeoutSec: p.limits.gateTimeout });
  return { ok: status === 0, output: output.split("\n").slice(-60).join("\n") };
}

export const runGate = (p: Project, dir: string): Promise<CheckResult> => runCheck(p, dir, p.fullCheck);
