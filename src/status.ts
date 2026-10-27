import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { worktreeOf } from "./areas.ts";
import { BLOCKED, count, DONE, OPEN, tasksFile } from "./tasks.ts";
import type { Project } from "./types.ts";

export interface ItemRow {
  epoch: number;
  round: number;
  area: string;
  status: string;
  seconds: number;
}

export function readItems(p: Project): ItemRow[] {
  const file = join(p.stateDir, "items.tsv");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [epoch, round, area, status, seconds] = line.split("\t");
      return { epoch: Number(epoch), round: Number(round), area: area ?? "", status: status ?? "", seconds: Number(seconds) };
    });
}

export function readLines(file: string): string[] {
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [];
}

export function isRunning(p: Project): number | undefined {
  const file = join(p.stateDir, "orchestrator.pid");
  if (!existsSync(file)) return undefined;
  const pid = Number(readFileSync(file, "utf8"));
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return undefined;
  }
}

/** Where the loop is: items per area, round, running or not, rough ETA, last log lines. */
export function status(p: Project, logLines = 8): string {
  const pid = isRunning(p);
  const state = existsSync(join(p.stateDir, "COMPLETE")) ? "COMPLETE" : pid ? `running (pid ${pid})` : "stopped";
  const round = existsSync(join(p.stateDir, "round")) ? readFileSync(join(p.stateDir, "round"), "utf8").trim() : "0";
  const items = readItems(p);
  const out = [`project: ${p.name}   state: ${state}   round: ${round}`];
  const row = (...c: (string | number)[]) => out.push(`${String(c[0]).padEnd(14)} ${c.slice(1).map((x) => String(x).padStart(8)).join(" ")}`);
  row("area", "done", "open", "blocked", "avg-min", "eta-min");
  let maxEta = 0;
  for (const area of p.areas) {
    let file = tasksFile(p, worktreeOf(p, area), area);
    if (!existsSync(file)) file = tasksFile(p, p.repo, area);
    const open = count(file, OPEN);
    const done = items.filter((i) => i.area === area && i.status === "done");
    const avg = done.length ? done.reduce((s, i) => s + i.seconds, 0) / done.length : 0;
    const eta = Math.round((open * avg) / 60);
    maxEta = Math.max(maxEta, eta);
    row(area, count(file, DONE), open, count(file, BLOCKED), Math.round(avg / 60), eta);
  }
  out.push(`rough ETA for this round's open items: ~${maxEta} min (areas run in parallel; merge, checks and planning come on top)`);
  const violations = readLines(join(p.stateDir, "violations.log"));
  if (violations.length) out.push(`ownership warnings: ${violations.length} (see ${join(p.stateDir, "violations.log")})`);
  out.push("--- last log lines", ...(logLines ? readLines(join(p.stateDir, "ralph.log")).slice(-logLines) : []));
  return out.join("\n");
}
