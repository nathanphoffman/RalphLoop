import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { liveSpecFile, seedLiveSpec, syncLiveSpec } from "../src/livespec.ts";
import type { Project } from "../src/types.ts";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "livespec-"));
  const repo = join(root, "repo");
  const runsDir = join(root, "runs");
  mkdirSync(join(repo, "ralph"), { recursive: true });
  mkdirSync(runsDir);
  const git = (...args: string[]) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args]);
  git("init", "-q");
  writeFileSync(join(repo, "ralph", "SPEC.md"), "old spec\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  const p = { repo, runsDir, loopDir: "ralph", commitTrailer: "Co-Authored-By: t" } as unknown as Project;
  return { p, repo, git };
}

test("the live spec is seeded from the committed one and not overwritten", () => {
  const { p } = setup();
  seedLiveSpec(p);
  assert.equal(readFileSync(liveSpecFile(p), "utf8"), "old spec\n");
  writeFileSync(liveSpecFile(p), "mine\n");
  seedLiveSpec(p);
  assert.equal(readFileSync(liveSpecFile(p), "utf8"), "mine\n");
});

test("an edited live spec is copied into the checkout and committed once", () => {
  const { p, repo, git } = setup();
  seedLiveSpec(p);
  assert.equal(syncLiveSpec(p, repo), false);
  writeFileSync(liveSpecFile(p), "new milestone\n");
  assert.equal(syncLiveSpec(p, repo), true);
  assert.equal(readFileSync(join(repo, "ralph", "SPEC.md"), "utf8"), "new milestone\n");
  assert.match(git("log", "-1", "--format=%s").toString(), /SPEC.md updated from the live file/);
  assert.equal(syncLiveSpec(p, repo), false);
});

test("with no live spec nothing happens", () => {
  const { p, repo } = setup();
  assert.equal(syncLiveSpec(p, repo), false);
});
