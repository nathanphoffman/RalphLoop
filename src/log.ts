import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { reportLogLine } from "./notify.ts";
import type { Project } from "./types.ts";

const stamp = () => new Date().toLocaleString("sv"); // 2026-10-27 18:56:57

export function ensureState(p: Project): void {
  mkdirSync(join(p.stateDir, "logs"), { recursive: true });
}

export function log(p: Project, tag: string, message: string): void {
  const line = `${stamp()} [${tag}] ${message}\n`;
  ensureState(p);
  appendFileSync(join(p.stateDir, "ralph.log"), line);
  process.stderr.write(line);
  reportLogLine(p, tag, message);
}

export type ItemStatus = "done" | "fail" | "blocked";

/** One row per worker session: epoch, round, area, status, seconds. status.ts and report.ts read it. */
export function recordItem(p: Project, round: number, area: string, status: ItemStatus, seconds: number): void {
  ensureState(p);
  appendFileSync(
    join(p.stateDir, "items.tsv"),
    `${Math.floor(Date.now() / 1000)}\t${round}\t${area}\t${status}\t${seconds}\n`,
  );
}

export function appendLogFile(p: Project, name: string, text: string): void {
  ensureState(p);
  appendFileSync(join(p.stateDir, "logs", name), text.endsWith("\n") ? text : text + "\n");
}
