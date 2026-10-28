import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worktreeOf } from "./areas.ts";
import { ensureState } from "./log.ts";
import { readQuality } from "./quality.ts";
import { readItems, readLines, status } from "./status.ts";
import { BLOCKED, tasksFile } from "./tasks.ts";
import type { Project } from "./types.ts";

/** Markdown report of the run. Written to <state>/report.md and returned. */
export function report(p: Project): string {
  const items = readItems(p);
  const rows = new Map<string, { round: number; area: string; done: number; fail: number; blocked: number; seconds: number }>();
  for (const i of items) {
    const key = `${i.round}/${i.area}`;
    const r = rows.get(key) ?? { round: i.round, area: i.area, done: 0, fail: 0, blocked: 0, seconds: 0 };
    if (i.status === "done") r.done++;
    else if (i.status === "fail") r.fail++;
    else if (i.status === "blocked") r.blocked++;
    r.seconds += i.seconds;
    rows.set(key, r);
  }
  const sorted = [...rows.values()].sort((a, b) => a.round - b.round || a.area.localeCompare(b.area));
  const blocked = p.areas.flatMap((a) =>
    readLines(tasksFile(p, worktreeOf(p, a), a)).filter((l) => l.startsWith(BLOCKED)).map((l) => `- ${a}: ${l.slice(BLOCKED.length + 1)}`),
  );
  const violations = readLines(join(p.stateDir, "violations.log"));
  const problems = readLines(join(p.stateDir, "ralph.log")).filter((l) => /WARNING|still red|stalled|interrupted|rate limited|no progress/.test(l));
  const decisions = readLines(join(p.repo, p.loopDir, "DECISIONS.md")).filter((l) => l.startsWith("- "));
  const progressFile = join(p.repo, p.loopDir, "PROGRESS.md");

  const text = [
    `# Ralph report: ${p.name}`,
    `Generated ${new Date().toLocaleString("sv")}`,
    "",
    "## Status",
    "```",
    status(p, 4),
    "```",
    "",
    "## Sessions per round",
    "| round | area | done | failed | blocked | minutes |",
    "|---|---|---|---|---|---|",
    ...sorted.map((r) => `| ${r.round} | ${r.area} | ${r.done} | ${r.fail} | ${r.blocked} | ${Math.round(r.seconds / 60)} |`),
    "",
    "## Code quality score (codequality --full, newest last)",
    ...(readQuality(p).length
      ? readQuality(p).slice(-12).map((q) => `- round ${q.round} ${q.area}: ${q.score} ${q.grade}`)
      : ["no scores recorded yet"]),
    "",
    "## Blocked items",
    ...(blocked.length ? blocked : ["none"]),
    "",
    "## Ownership warnings",
    ...(violations.length ? violations.map((v) => `- ${v}`) : ["none"]),
    "",
    "## Warnings and problems from the log (last 20)",
    ...(problems.length ? problems.slice(-20).map((l) => `- ${l}`) : ["none"]),
    "",
    "## Latest decisions (last 15)",
    ...(decisions.length ? decisions.slice(-15) : ["none"]),
    "",
    "## Milestones (end of PROGRESS.md)",
    existsSync(progressFile) ? readFileSync(progressFile, "utf8").split("\n").slice(-30).join("\n") : "none yet",
    "",
  ].join("\n");
  ensureState(p);
  writeFileSync(join(p.stateDir, "report.md"), text);
  return text;
}
