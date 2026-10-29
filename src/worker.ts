import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ownsOf, worktreeOf } from "./areas.ts";
import { runClaude } from "./claude.ts";
import { log, recordItem } from "./log.ts";
import { renderPrompt } from "./prompts.ts";
import { recordQuality } from "./quality.ts";
import { commitIfDirty, git, resetClean } from "./shell.ts";
import { firstOpen, hasOpen, markBlocked, tasksFile } from "./tasks.ts";
import type { Project } from "./types.ts";

/** Works through tasks/<area>.md in the area's worktree, one Claude session per item. Returns when no open items remain. */
export async function runWorker(p: Project, area: string, round: number): Promise<void> {
  const tag = `worker:${area}`;
  const dir = worktreeOf(p, area);
  if (!existsSync(dir)) throw new Error(`no worktree at ${dir} (run: ralph setup ${p.name})`);
  const tasks = tasksFile(p, dir, area);
  const logName = `round-${round}-${area}-claude.log`;
  const { maxItemFails, maxItemsPerRound, qualityEvery } = p.limits;
  let fails = 0;
  let items = 0;
  let sinceQuality = 0;

  // Warn (never revert) when an item touched files outside the area's ownership.
  const checkOwnership = (fromCommit: string): void => {
    const owns = ownsOf(p, area);
    if (!owns) return;
    const always = new RegExp(`^${p.loopDir}/(tasks/${area}\\.md|DECISIONS\\.md|CONTRACTS\\.md)$`);
    for (const file of git(dir, "diff", "--name-only", fromCommit, "HEAD").split("\n").filter(Boolean)) {
      if (owns.test(file) || p.integrationFiles?.test(file) || always.test(file)) continue;
      log(p, tag, `OWNERSHIP: ${file} changed outside ${area}'s area`);
      appendFileSync(join(p.stateDir, "violations.log"), `round ${round} ${area} ${file}\n`);
    }
  };

  // Between features: full checks, then the quality command (prompts/quality.md).
  const qualityPass = async (): Promise<void> => {
    if (qualityEvery <= 0) return;
    log(p, tag, "quality pass");
    await runClaude(p, dir, renderPrompt(p, "quality", { area, round }), logName, tag);
    commitIfDirty(p, dir, `ralph(${area}): checkpoint after quality pass`, tag);
    await recordQuality(p, dir, round, area);
    resetClean(dir);
  };

  while (hasOpen(tasks) && items < maxItemsPerRound) {
    items++;
    const item = firstOpen(tasks)!;
    const startHead = git(dir, "rev-parse", "HEAD");
    const started = Date.now();
    log(p, tag, `item ${items}: ${item.slice(0, 90)}`);

    await runClaude(p, dir, renderPrompt(p, "worker", { area, round }), logName, tag);
    commitIfDirty(p, dir, `ralph(${area}): checkpoint after item`, tag);
    const seconds = Math.round((Date.now() - started) / 1000);

    if (firstOpen(tasks) !== item) {
      fails = 0;
      recordItem(p, round, area, "done", seconds);
      checkOwnership(startHead);
      sinceQuality++;
      if (qualityEvery > 0 && sinceQuality >= qualityEvery) {
        await qualityPass();
        sinceQuality = 0;
      }
      continue;
    }

    // No progress: throw away half-done edits so the next try starts clean.
    fails++;
    resetClean(dir);
    recordItem(p, round, area, "fail", seconds);
    log(p, tag, `no progress on item (fail ${fails} of ${maxItemFails})`);
    if (fails >= maxItemFails) {
      markBlocked(tasks, item, maxItemFails);
      commitIfDirty(p, dir, `ralph(${area}): mark item blocked`, tag);
      recordItem(p, round, area, "blocked", 0);
      fails = 0;
    }
  }

  if (sinceQuality > 0) await qualityPass(); // one at the end of the list too
  log(p, tag, `done (${items} sessions)`);
}
