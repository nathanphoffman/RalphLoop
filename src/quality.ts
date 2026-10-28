import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "./log.ts";
import { runLimited } from "./shell.ts";
import type { Project } from "./types.ts";

const SCORE = /TOTAL SCORE\s+(\d+(?:\.\d+)?)\s*\/\s*100\s+(\S+)/;

export interface QualityEntry {
  time: string;
  round: number;
  area: string;
  score: number;
  grade: string;
}

const qualityFile = (p: Project): string => join(p.stateDir, "quality.tsv");

/** Every recorded score, oldest first. Lines are: time, round, area, score, grade (tab separated). */
export function readQuality(p: Project): QualityEntry[] {
  if (!existsSync(qualityFile(p))) return [];
  return readFileSync(qualityFile(p), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"))
    .map(([time, round, area, score, grade]) => ({ time: time!, round: Number(round), area: area!, score: Number(score), grade: grade! }));
}

/** Run the project's quality command in <dir> and append its total score to <state>/quality.tsv.
 *  The command's output must contain a line like "TOTAL SCORE 80.4 / 100 B-". Does nothing when no command is set. */
export async function recordQuality(p: Project, dir: string, round: number, area: string): Promise<QualityEntry | undefined> {
  if (!p.qualityCmd) return undefined;
  const { output } = await runLimited(p, ["bash", "-c", p.qualityCmd], { cwd: dir, timeoutSec: p.limits.gateTimeout });
  const match = SCORE.exec(output);
  if (!match) {
    log(p, "quality", `could not read a score from: ${p.qualityCmd}`);
    return undefined;
  }
  const entry: QualityEntry = { time: new Date().toLocaleString("sv"), round, area, score: Number(match[1]), grade: match[2]! };
  appendFileSync(qualityFile(p), `${entry.time}\t${round}\t${area}\t${entry.score}\t${entry.grade}\n`);
  const before = readQuality(p).at(-2);
  const change = before ? ` (${entry.score >= before.score ? "+" : ""}${(entry.score - before.score).toFixed(1)} since round ${before.round} ${before.area})` : "";
  log(p, "quality", `score ${entry.score} ${entry.grade} in ${area}, round ${round}${change}`);
  return entry;
}
