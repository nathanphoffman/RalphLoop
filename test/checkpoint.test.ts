import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { requestContinue, waitAtCheckpoint } from "../src/checkpoint.ts";
import type { Project } from "../src/types.ts";

const projectIn = (stateDir: string) => ({ name: "t", stateDir, limits: {} }) as unknown as Project;

test("the checkpoint wait ends when continue is requested", async () => {
  const p = projectIn(mkdtempSync(join(tmpdir(), "ralph-cp-")));
  setTimeout(() => requestContinue(p), 30);
  assert.equal(await waitAtCheckpoint(p, 5, 10), "continued");
});

test("the checkpoint wait ends on its own after the time is up", async () => {
  const p = projectIn(mkdtempSync(join(tmpdir(), "ralph-cp-")));
  let clock = 0;
  const outcome = await waitAtCheckpoint(p, 1, 1, () => (clock += 20_000));
  assert.equal(outcome, "timed-out");
});
