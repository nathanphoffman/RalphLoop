import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worktreeOf } from "./areas.ts";
import { runClaude } from "./claude.ts";
import { runGate } from "./checks.ts";
import { ensureState, log } from "./log.ts";
import { ensureControlFile, waitAtCheckpoint } from "./checkpoint.ts";
import { renderPrompt } from "./prompts.ts";
import { recordQuality } from "./quality.ts";
import { commitIfDirty, git, gitOk, killChildren } from "./shell.ts";
import { count, OPEN, tasksFile } from "./tasks.ts";
import type { Project } from "./types.ts";
import { runWorker } from "./worker.ts";

const TAG = "orchestrator";

/** The single loop. Round 0 builds the skeleton, then each round:
 *  workers in parallel -> merge on the integration branch -> checks -> progress + next tasks -> fast-forward base -> sync worktrees.
 *  Returns the exit code: 0 complete, 1 setup problem, 2 planner stalled, 3 max rounds, 4 red round, 5 cannot advance base. */
export async function runOrchestrator(p: Project): Promise<number> {
  ensureState(p);
  ensureControlFile(p);
  const complete = join(p.stateDir, "COMPLETE");
  const claude = (dir: string, prompt: string, round: number, gateOutput = "") =>
    runClaude(p, dir, renderPrompt(p, prompt, { round, gateOutput }), `round-${round}-${prompt}.log`, TAG);

  // Run the full checks in <dir>; on failure ask Claude to fix, up to 3 times.
  const ensureGreen = async (round: number, dir: string): Promise<boolean> => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const gate = await runGate(p, dir);
      if (gate.ok) {
        commitIfDirty(p, dir, `ralph: formatting after round ${round}`);
        return true;
      }
      log(p, TAG, `checks failed in ${dir.split("/").pop()} (attempt ${attempt})`);
      await claude(dir, "fixbuild", round, gate.output);
    }
    return (await runGate(p, dir)).ok;
  };

  // Rounds are merged in a separate worktree, so the base branch only ever moves to a commit that passed.
  const prepareIntegration = (): void => {
    if (!existsSync(p.integrationDir)) {
      git(p.repo, "worktree", "prune");
      git(p.repo, "worktree", "add", "-q", "-B", p.integrationBranch, p.integrationDir, p.baseBranch);
    } else {
      git(p.integrationDir, "reset", "-q", "--hard", p.baseBranch);
      git(p.integrationDir, "clean", "-qfd");
    }
  };

  // Fast-forward the base branch to integration (a plain merge if you committed to it meanwhile).
  const advanceBase = (): void => {
    if (!gitOk(p.repo, "merge", "-q", "--ff-only", p.integrationBranch)) git(p.repo, "merge", "-q", "--no-edit", p.integrationBranch);
  };

  // Move each worktree onto the base branch. Merged branches are fast-forwarded; others are rebased.
  const syncWorktrees = (): void => {
    for (const area of p.areas) {
      const dir = worktreeOf(p, area);
      if (gitOk(dir, "merge-base", "--is-ancestor", "HEAD", p.baseBranch)) git(dir, "reset", "-q", "--hard", p.baseBranch);
      else if (!gitOk(dir, "rebase", "-q", p.baseBranch)) {
        gitOk(dir, "rebase", "--abort");
        log(p, TAG, `WARNING: ${area} could not be rebased onto ${p.baseBranch}, left as is`);
      }
    }
  };

  const preflight = (): string | undefined => {
    if (git(p.repo, "branch", "--show-current") !== p.baseBranch) return `${p.repo} is not on branch ${p.baseBranch}`;
    if (!gitOk(p.repo, "ls-files", "--error-unmatch", `${p.loopDir}/SPEC.md`)) return `${p.loopDir}/ is not committed yet: run ralph setup ${p.name}`;
    if (git(p.repo, "status", "--porcelain")) return `${p.baseBranch} has uncommitted changes, commit or stash first`;
    const missing = p.areas.find((a) => !existsSync(worktreeOf(p, a)));
    if (missing) return `no worktree for ${missing}: run ralph setup ${p.name}`;
    return undefined;
  };

  const stop = (): void => {
    log(p, TAG, "interrupted");
    killChildren();
    process.exit(130);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const problem = preflight();
  if (problem) {
    log(p, TAG, problem);
    return 1;
  }
  writeFileSync(join(p.stateDir, "orchestrator.pid"), String(process.pid));

  const round0Marker = join(p.stateDir, "round0-done");
  if (p.skeletonStep && !existsSync(round0Marker)) {
    log(p, TAG, "round 0: skeleton");
    await claude(p.repo, "round0", 0);
    if (!(await ensureGreen(0, p.repo))) {
      log(p, TAG, "round 0 does not pass the checks, stopping");
      return 1;
    }
    syncWorktrees();
    writeFileSync(round0Marker, "");
  }

  // Resume where the last checkpoint stopped (RALPH_START_ROUND overrides).
  const nextRoundFile = join(p.stateDir, "next-round");
  const savedRound = existsSync(nextRoundFile) ? Number(readFileSync(nextRoundFile, "utf8").trim()) : 1;
  const firstRound = Number(process.env.RALPH_START_ROUND ?? savedRound);

  for (let round = firstRound; !existsSync(complete); round++) {
    if (round > p.limits.maxRounds) {
      log(p, TAG, `reached MAX_ROUNDS (${p.limits.maxRounds}), stopping`);
      return 3;
    }
    log(p, TAG, `===== round ${round} =====`);
    writeFileSync(join(p.stateDir, "round"), String(round));

    const results = await Promise.allSettled(p.areas.map((area) => runWorker(p, area, round)));
    results.forEach((r, i) => {
      if (r.status === "rejected") log(p, TAG, `WARNING: ${p.areas[i]} worker failed (${String(r.reason)}), merging what it committed`);
    });

    prepareIntegration();
    await claude(p.integrationDir, "merge", round);
    let green = await ensureGreen(round, p.integrationDir);
    if (green) await recordQuality(p, p.integrationDir, round, "merged");
    await claude(p.integrationDir, "plan", round);
    commitIfDirty(p, p.integrationDir, `ralph: round ${round} progress and next tasks`);

    // COMPLETE only counts if the result passes the checks.
    if (existsSync(complete) && !(await runGate(p, p.integrationDir)).ok) {
      log(p, TAG, "COMPLETE was claimed but the result is red, removing it");
      rmSync(complete);
      green = false;
    }
    if (!green) {
      log(p, TAG, `round ${round} is still red after fixing attempts: ${p.baseBranch} was NOT updated. Look at branch ${p.integrationBranch} in ${p.integrationDir}, then restart.`);
      return 4;
    }
    try {
      advanceBase();
    } catch {
      log(p, TAG, `could not move ${p.baseBranch} to ${p.integrationBranch}`);
      return 5;
    }
    syncWorktrees();

    if (!existsSync(complete)) {
      const open = p.areas.reduce((n, a) => n + count(tasksFile(p, p.repo, a), OPEN), 0);
      if (open === 0) {
        log(p, TAG, "no open tasks and no COMPLETE: planner stalled, stopping");
        return 2;
      }
    }

    // Checkpoint: stop between rounds (base branch is green, worktrees are synced) so the user can test the game.
    writeFileSync(nextRoundFile, String(round + 1));
    const pauseFile = join(p.stateDir, "PAUSE");
    const isCheckpoint = p.limits.checkpointEvery > 0 && (round - firstRound + 1) % p.limits.checkpointEvery === 0;
    if (!existsSync(complete) && (existsSync(pauseFile) || isCheckpoint)) {
      rmSync(pauseFile, { force: true });
      await waitAtCheckpoint(p, p.limits.checkpointWaitMinutes);
    }
  }
  log(p, TAG, "COMPLETE");
  return 0;
}
