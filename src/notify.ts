import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { worktreeOf } from "./areas.ts";
import { BLOCKED, count, DONE, OPEN, tasksFile } from "./tasks.ts";
import type { Project } from "./types.ts";

// The script lives in the GraphData repo so it can be changed there; RALPH_REPORT_SCRIPT overrides the path, RALPH_REPORT=off disables it.
const SCRIPT = process.env.RALPH_REPORT_SCRIPT ?? join(process.env.RALPH_HOST_HOME ?? homedir(), "Code/GraphData/scripts/ralph-report.mjs");

// Log lines worth sending to the live site; everything else (every item, every retry) stays in ralph.log.
const WORTH_REPORTING = /^(=====|COMPLETE|WARNING|CHECKPOINT|checks failed|interrupted|reached MAX_ROUNDS|round \d+ is still red|no open tasks|could not)/;

/** Fire and forget: tells the GraphData site about this log line, with the current counts per area. Never throws or waits. */
export function reportLogLine(p: Project, tag: string, message: string): void {
  if (process.env.RALPH_REPORT === "off" || tag !== "orchestrator" || !WORTH_REPORTING.test(message) || !existsSync(SCRIPT)) return;

  try {
    const complete = existsSync(join(p.stateDir, "COMPLETE"));
    const state = complete || message.startsWith("COMPLETE") ? "complete" : /^(interrupted|reached|no open|round \d+ is still red)/.test(message) ? "stopped" : "running";
    // The round file is written just after the "===== round N =====" line, so that line carries the number itself.
    const file = join(p.stateDir, "round");
    const roundNumber = Number(/round (\d+)/.exec(message)?.[1] ?? (existsSync(file) ? readFileSync(file, "utf8") : 0));
    const areas = p.areas.flatMap((area) => {
      let tasks = tasksFile(p, worktreeOf(p, area), area);
      if (!existsSync(tasks)) tasks = tasksFile(p, p.repo, area);
      return ["--area", `${area}=${count(tasks, DONE)}/${count(tasks, OPEN)}/${count(tasks, BLOCKED)}`];
    });
    const kind = message.startsWith("=====") ? "round" : /^(WARNING|checks failed|round \d+ is still red|could not)/.test(message) ? "problem" : "info";
    const child = spawn("node", [SCRIPT, p.name, kind, message.replace(/=/g, "").trim(), "--state", state, "--round", String(roundNumber), ...areas], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Reporting must never break the loop.
  }
}
