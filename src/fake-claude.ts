// Stand-in for `claude -p` used by dryrun.ts. It does what each Ralph prompt asks, in the simplest possible way.
// Called as: node fake-claude.ts -p "<prompt>" --dangerously-skip-permissions
// Reads the first line of the prompt: [ralph:<kind> key=value ...]
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prompt = process.argv[3] ?? "";
const header = prompt.split("\n")[0] ?? "";
const kind = /^\[ralph:([a-z0-9]+)/.exec(header)?.[1];
const field = (key: string): string => new RegExp(`${key}=([^\\] ]*)`).exec(header)?.[1] ?? "";
const round = Number(field("round"));
const loop = process.env.LOOP_DIR ?? "ralph";
const stateDir = process.env.STATE_DIR ?? "";
const identity = { GIT_AUTHOR_NAME: "fake", GIT_AUTHOR_EMAIL: "fake@example.com", GIT_COMMITTER_NAME: "fake", GIT_COMMITTER_EMAIL: "fake@example.com" };
const git = (...args: string[]) => execFileSync("git", args, { env: { ...process.env, ...identity }, stdio: "ignore" });
const commit = (msg: string) => {
  git("add", "-A");
  git("commit", "-q", "-m", msg);
};

switch (kind) {
  case "worker": {
    const area = field("area");
    const file = join(loop, "tasks", `${area}.md`);
    writeFileSync(file, readFileSync(file, "utf8").replace("- [ ]", "- [x]"));
    mkdirSync(join("src", area), { recursive: true });
    writeFileSync(join("src", area, `dry-${process.hrtime.bigint()}.txt`), area);
    commit(`fake(${area}): did one item`);
    break;
  }
  case "round0":
    mkdirSync("src", { recursive: true });
    writeFileSync("src/skeleton.txt", "// fake skeleton\n");
    commit("fake: round 0 skeleton");
    break;
  case "merge":
    for (const branch of field("branches").split(",").filter(Boolean)) {
      try {
        git("merge", "--no-ff", "--no-edit", "-q", branch);
      } catch {
        git("merge", "--abort");
      }
    }
    break;
  case "plan":
    appendFileSync(join(loop, "PROGRESS.md"), `fake progress for round ${round}\n`);
    if (round >= Number(process.env.FAKE_COMPLETE_AT_ROUND ?? 1)) writeFileSync(join(stateDir, "COMPLETE"), "");
    else for (const area of field("areas").split(",")) writeFileSync(join(loop, "tasks", `${area}.md`), `- [ ] fake next-round item for ${area}\n`);
    commit(`fake: plan round ${round}`);
    break;
  case "quality":
  case "fixbuild":
    break;
  default:
    console.error(`fake-claude: unknown prompt kind '${kind}'`);
    process.exit(1);
}
