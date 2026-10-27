import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Project } from "./types.ts";

export const OPEN = "- [ ]";
export const DONE = "- [x]";
export const BLOCKED = "- [!]";

export function tasksFile(p: Project, checkout: string, area: string): string {
  return join(checkout, p.loopDir, "tasks", `${area}.md`);
}

function lines(file: string): string[] {
  return existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
}

export const firstOpen = (file: string): string | undefined => lines(file).find((l) => l.startsWith(OPEN));
export const hasOpen = (file: string): boolean => firstOpen(file) !== undefined;
export const count = (file: string, mark: string): number => lines(file).filter((l) => l.startsWith(mark)).length;

/** Turn the first line equal to <item> into a blocked line. */
export function markBlocked(file: string, item: string, fails: number): void {
  const all = lines(file);
  const at = all.indexOf(item);
  if (at < 0) return;
  all[at] = `${BLOCKED} (blocked after ${fails} failed tries) ${item.slice(OPEN.length + 1)}`;
  writeFileSync(file, all.join("\n"));
}
