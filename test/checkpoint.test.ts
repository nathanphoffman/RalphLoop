import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { controlFile, ensureControlFile, requestContinue, shouldContinueToNextRound, waitAtCheckpoint } from "../src/checkpoint.ts";
import type { Project } from "../src/types.ts";

function newProject(): Project {
  const runsDir = mkdtempSync(join(tmpdir(), "ralph-cp-"));
  const stateDir = join(runsDir, "state");

  mkdirSync(stateDir);

  return { name: "t", runsDir, stateDir, limits: { checkpointEvery: 2 } } as unknown as Project;
}

test("a new control file starts with the flag off", () => {
  const p = newProject();

  ensureControlFile(p);
  assert.equal(shouldContinueToNextRound(p), false);
});

test("the flag can be switched on by editing the file", () => {
  const p = newProject();

  ensureControlFile(p);
  writeFileSync(controlFile(p), "CONTINUE_TO_NEXT_ROUND=true\n");
  assert.equal(shouldContinueToNextRound(p), true);
});

test("with the flag on the checkpoint does not wait", async () => {
  const p = newProject();

  writeFileSync(controlFile(p), "CONTINUE_TO_NEXT_ROUND=true\n");
  assert.equal(await waitAtCheckpoint(p, 0, 10), "flag");
});

test("the wait ends when the flag is switched on while waiting", async () => {
  const p = newProject();

  ensureControlFile(p);
  setTimeout(() => writeFileSync(controlFile(p), "CONTINUE_TO_NEXT_ROUND=true\n"), 30);
  assert.equal(await waitAtCheckpoint(p, 0, 10), "flag");
});

test("the wait ends when continue is requested", async () => {
  const p = newProject();

  setTimeout(() => requestContinue(p), 30);
  assert.equal(await waitAtCheckpoint(p, 5, 10), "continued");
});

test("a limited wait ends on its own after the time is up", async () => {
  const p = newProject();
  let clock = 0;

  assert.equal(await waitAtCheckpoint(p, 1, 1, () => (clock += 20_000)), "timed-out");
});
