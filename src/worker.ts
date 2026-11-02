import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ownsOf, worktreeOf } from "./areas.ts";
import { runClaude, type ClaudeSession } from "./claude.ts";
import { log, recordItem } from "./log.ts";
import { renderPrompt } from "./prompts.ts";
import { recordQuality } from "./quality.ts";
import { reportCommitsSince } from "./notify.ts";
import { commitIfDirty, git, resetClean } from "./shell.ts";
import { continuesPrevious, firstOpen, hasOpen, markBlocked, tasksFile } from "./tasks.ts";
import type { Project } from "./types.ts";

const continuePrompt = (tasksPath: string): string =>
  `Do the next item now: the first "- [ ]" line in ${tasksPath}. Follow the same rules and steps as for the previous item ` +
  `(do the work, run the checks, tick the item, commit). What you learned in the previous item still applies, but re-read ` +
  `any file that changed since.`;

/** Works through tasks/<area>.md in the area's worktree, one Claude session per item. Returns when no open items remain. */
export async function runWorker(p: Project, area: string, round: number): Promise<void> {
  const tag = `worker:${area}`;
  const dir = worktreeOf(p, area);
  if (!existsSync(dir)) throw new Error(`no worktree at ${dir} (run: ralph setup ${p.name})`);
  const tasks = tasksFile(p, dir, area);
  const logName = `round-${round}-${area}-claude.log`;
  const { maxItemFails, maxItemsPerRound, maxItemsPerContext, qualityEvery } = p.limits;
  let fails = 0;
  let items = 0;
  let sinceQuality = 0;
  // The Claude conversation the last item ran in. A later item tagged (continues previous) resumes it instead of re-reading everything.
  let context: { id: string; itemsServed: number } | undefined;

  const sessionFor = (item: string): { session?: ClaudeSession; resumed: boolean } => {
    if (maxItemsPerContext <= 1) return { resumed: false };
    const resumed = continuesPrevious(item) && context !== undefined && context.itemsServed < maxItemsPerContext;
    if (!resumed) context = { id: randomUUID(), itemsServed: 0 };
    return { session: { id: context!.id, resume: resumed }, resumed };
  };

  // An unfinished item still counts as progress when the session committed changes outside the loop's own files.
  const changedCode = (fromCommit: string): boolean =>
    git(dir, "diff", "--name-only", fromCommit, "HEAD")
      .split("\n")
      .filter(Boolean)
      .some((file) => !file.startsWith(`${p.loopDir}/`));

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
    const before = git(dir, "rev-parse", "HEAD");
    await runClaude(p, dir, renderPrompt(p, "quality", { area, round }), logName, tag);
    commitIfDirty(p, dir, `ralph(${area}): checkpoint after quality pass`, tag);
    reportCommitsSince(p, dir, tag, before);
    await recordQuality(p, dir, round, area);
    resetClean(dir);
    context = undefined; // the quality pass changed the files under that conversation
  };

  while (hasOpen(tasks) && items < maxItemsPerRound) {
    items++;
    const item = firstOpen(tasks)!;
    const startHead = git(dir, "rev-parse", "HEAD");
    const started = Date.now();
    log(p, tag, `item ${items}: ${item.slice(0, 90)}`);

    const { session, resumed } = sessionFor(item);
    const prompt = resumed ? continuePrompt(tasks) : renderPrompt(p, "worker", { area, round });
    if (resumed) log(p, tag, "resuming the previous conversation");
    await runClaude(p, dir, prompt, logName, tag, session);
    if (context) context.itemsServed++;
    commitIfDirty(p, dir, `ralph(${area}): checkpoint after item`, tag);
    reportCommitsSince(p, dir, tag, startHead);
    const seconds = Math.round((Date.now() - started) / 1000);

    const ticked = firstOpen(tasks) !== item;
    if (ticked || changedCode(startHead)) {
      fails = 0;
      recordItem(p, round, area, ticked ? "done" : "partial", seconds);
      if (!ticked) log(p, tag, "item not finished, but it committed code: counts as progress");
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
    context = undefined; // a failed item leaves a muddled conversation
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
