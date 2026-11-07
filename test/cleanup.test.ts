import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveProject } from "../src/config.ts";
import { cleanupDue } from "../src/orchestrator.ts";

const base = { repo: "/tmp/none", areas: { a: {}, b: {} } };

test("cleanup defaults to never", () => {
  const p = resolveProject("t", base, "/tmp/none-project");
  assert.deepEqual(p.cleanup, { everyRounds: 0, cmd: "" });
  assert.equal(cleanupDue(p, 1), false);
  assert.equal(cleanupDue(p, 2), false);
});

test("cleanup is due after every Nth round", () => {
  const p = resolveProject("t", { ...base, cleanup: { everyRounds: 2, cmd: "cargo clean -p x" } }, "/tmp/none-project");
  assert.equal(p.cleanup.cmd, "cargo clean -p x");
  assert.deepEqual([1, 2, 3, 4, 5].map((r) => cleanupDue(p, r)), [false, true, false, true, false]);
});
