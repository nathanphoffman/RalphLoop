import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { git } from "./shell.ts";
import { worktreeOf } from "./areas.ts";
import { BLOCKED, count, DONE, OPEN, tasksFile } from "./tasks.ts";
import type { Project } from "./types.ts";

// The script lives in the GraphData repo so it can be changed there; RALPH_REPORT_SCRIPT overrides the path, RALPH_REPORT=off disables it.
const SCRIPT = process.env.RALPH_REPORT_SCRIPT ?? join(process.env.RALPH_HOST_HOME ?? homedir(), "Code/GraphData/scripts/ralph-report.mjs");

// Every log line goes to the live site (worker items, quality scores, merge, planner, orchestrator). Lines that only repeat
// the same file-ownership warning are left out; set RALPH_REPORT=off to stop reporting altogether.
const NOT_REPORTED = /^OWNERSHIP:/;

/** Runs the report script in the background; never throws or waits. */
function send(args: string[]): void {
  try {
    const child = spawn("node", [SCRIPT, ...args], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Reporting must never break the loop.
  }
}

const reporting = (): boolean => process.env.RALPH_REPORT !== "off" && existsSync(SCRIPT);

/** Fire and forget: tells the GraphData site about this log line, with the current counts per area. Never throws or waits. */
export function reportLogLine(p: Project, tag: string, message: string): void {
  if (!reporting() || NOT_REPORTED.test(message)) return;

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
    const text = message.replace(/=/g, "").trim();
    const kind = message.startsWith("=====") ? "round" : /^(WARNING|checks failed|round \d+ is still red|could not)/.test(message) ? "problem" : "info";
    send([p.name, kind, text, "--source", tag, "--state", state, "--round", String(roundNumber), ...areas]);
    // The files change between rounds, so they are sent when a round starts and when the loop ends.
    if (message.startsWith("=====") || state !== "running") reportFiles(p);
  } catch {
    // Reporting must never break the loop.
  }
}

/** Lines in all text files of the commit just made in <dir> (blank lines and lockfiles included); 0 when it cannot be counted. */
function projectLines(dir: string): number {
  try {
    // One "HEAD:path:count" line per file; binary files are skipped.
    return git(dir, "grep", "-I", "-c", "", "HEAD")
      .split("\n")
      .reduce((sum, line) => sum + (Number(line.slice(line.lastIndexOf(":") + 1)) || 0), 0);
  } catch {
    return 0;
  }
}

/** Tells the live site about the commit just made in <dir>: subject, lines added and removed, files changed. */
export function reportCommit(p: Project, dir: string, source: string): void {
  if (!reporting()) return;

  try {
    const [sha = "", subject = "", ...stats] = git(dir, "show", "--numstat", "--format=%H%n%s", "HEAD").split("\n").filter(Boolean);
    // Each stat line is "added<TAB>removed<TAB>file"; binary files show "-" and count as no lines.
    const rows = stats.map((line) => line.split("\t"));
    const total = (column: number) => rows.reduce((sum, row) => sum + (Number(row[column]) || 0), 0);
    send([p.name, "commit", subject, "--source", source, "--sha", sha, "--added", String(total(0)), "--removed", String(total(1)), "--files", String(rows.length), "--total", String(projectLines(dir))]);
  } catch {
    // Reporting must never break the loop.
  }
}

const LOG_TAIL_BYTES = 60_000;

/** Sends the newest copy of the loop's spec and notes, and the end of ralph.log, so the site can show them. */
export function reportFiles(p: Project): void {
  if (!reporting()) return;

  try {
    for (const name of ["SPEC.md", "PROGRESS.md", "DECISIONS.md", "CONTRACTS.md"]) {
      const file = join(p.repo, p.loopDir, name);
      if (existsSync(file)) send([p.name, "file", name, "--path", file]);
    }
    const log = join(p.stateDir, "ralph.log");
    if (existsSync(log)) {
      // The site stores a bounded copy, so only the end of the log is sent (from a temp copy, since the log keeps growing).
      const tail = join(p.stateDir, "ralph.log.tail");
      writeFileSync(tail, readFileSync(log, "utf8").slice(-LOG_TAIL_BYTES));
      send([p.name, "file", "ralph.log", "--path", tail]);
    }
  } catch {
    // Reporting must never break the loop.
  }
}
