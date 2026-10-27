import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { worktreeOf } from "./areas.ts";
import { HOME, resolveProject } from "./config.ts";
import { runOrchestrator } from "./orchestrator.ts";
import { setup } from "./setup.ts";
import { git, gitOk } from "./shell.ts";
import { readLines, readItems, status } from "./status.ts";

/** Runs setup + the whole orchestrator against a throwaway toy repo (two areas, alpha and beta) with a fake `claude`
 *  and no real checks. Proves the loop mechanics work. Touches nothing outside the sandbox dir. Returns 0 when all checks pass. */
export async function dryrun(sandboxArg?: string): Promise<number> {
  const sandbox = sandboxArg ?? mkdtempSync(join(tmpdir(), "ralph-dry-"));
  rmSync(sandbox, { recursive: true, force: true });
  mkdirSync(sandbox, { recursive: true });
  const gitEnv = { GIT_AUTHOR_NAME: "dry", GIT_AUTHOR_EMAIL: "dry@example.com", GIT_COMMITTER_NAME: "dry", GIT_COMMITTER_EMAIL: "dry@example.com" };
  Object.assign(process.env, gitEnv);

  const repo = join(sandbox, "repo");
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  mkdirSync(join(repo, "ralph", "tasks"), { recursive: true });
  const templates = join(HOME, "templates", "loop");
  for (const f of readdirSync(templates).filter((f) => f.endsWith(".md"))) cpSync(join(templates, f), join(repo, "ralph", f));
  for (const a of ["alpha", "beta"]) writeFileSync(join(repo, "ralph", "tasks", `${a}.md`), `# ${a} tasks\n\n- [ ] first ${a} item\n- [ ] second ${a} item\n`);
  writeFileSync(join(repo, "README.md"), "toy\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "toy repo");

  process.env.RALPH_RUNS_DIR = join(sandbox, "runs");
  process.env.RALPH_CLAUDE = `node ${join(HOME, "src", "fake-claude.ts")}`;
  process.env.RALPH_SKIP_GATE = "1";
  process.env.FAKE_COMPLETE_AT_ROUND = "2";
  process.env.RALPH_MAX_ROUNDS = "4";
  process.env.RALPH_BACKOFF_START = "1";
  const p = resolveProject("dryrun", { repo, areas: { alpha: { owns: /^src\/alpha\// }, beta: { owns: /^src\/beta\// } } }, sandbox);
  process.env.LOOP_DIR = p.loopDir;
  process.env.STATE_DIR = p.stateDir;

  console.log(setup(p).join("\n"));
  await runOrchestrator(p);

  console.log("---- checks");
  let failed = false;
  const check = (name: string, ok: boolean) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
    if (!ok) failed = true;
  };
  const main = git(repo, "rev-parse", "main");
  check("COMPLETE exists", existsSync(join(p.stateDir, "COMPLETE")));
  check("both branches merged", git(repo, "log", "--oneline").split("\n").filter((l) => l.includes("Merge branch 'ralph/")).length >= 2);
  check("work landed on main", gitOk(repo, "cat-file", "-e", "main:src") && git(repo, "ls-tree", "-r", "--name-only", "main").includes("src/alpha/dry-") && git(repo, "ls-tree", "-r", "--name-only", "main").includes("src/beta/dry-"));
  check("worktrees sit on main", p.areas.every((a) => git(worktreeOf(p, a), "rev-parse", "HEAD") === main));
  check("items were recorded", readItems(p).filter((i) => i.status === "done").length >= 4);
  check("no ownership violations", readLines(join(p.stateDir, "violations.log")).length === 0);
  check("tasks file kept", readFileSync(join(repo, "ralph", "PROGRESS.md"), "utf8").includes("fake progress"));
  console.log("\n" + status(p));
  console.log(`sandbox: ${sandbox}`);
  return failed ? 1 : 0;
}
