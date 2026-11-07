import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { HOME, resolveProject } from "../src/config.ts";

const base = { repo: "/tmp/none", areas: { a: {}, b: {} } };

test("buildLock puts bin/ first on PATH and names the lock file in the state dir", () => {
  const p = resolveProject("t", { ...base, buildLock: true, env: { CARGO_BUILD_JOBS: "6" } }, "/tmp/none-project");
  assert.ok(p.buildLock);
  assert.ok(p.env.PATH!.startsWith(join(HOME, "bin") + ":"));
  assert.equal(p.env.RALPH_BUILD_LOCK, join(p.stateDir, "build.lock"));
  assert.equal(p.env.CARGO_BUILD_JOBS, "6");
});

test("without buildLock the environment is left alone", () => {
  const p = resolveProject("t", { ...base, env: { X: "1" } }, "/tmp/none-project");
  assert.equal(p.buildLock, false);
  assert.deepEqual(p.env, { X: "1" });
});

test("bin/cargo runs two cargo calls one after the other, never overlapping", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ralph-lock-"));
  const log = join(dir, "log");
  // A fake cargo that records when it starts and ends, holding its slot for a moment.
  mkdirSync(join(dir, "fakebin"));
  const fake = join(dir, "fakebin", "cargo");
  writeFileSync(fake, `#!/bin/sh\necho "start $1 $(date +%s%N)" >> ${log}\nsleep 0.4\necho "end $1 $(date +%s%N)" >> ${log}\n`, { mode: 0o755 });
  chmodSync(fake, 0o755);
  const env = { ...process.env, PATH: `${join(HOME, "bin")}:${join(dir, "fakebin")}:${process.env.PATH}`, RALPH_BUILD_LOCK: join(dir, "lock") };
  const run = (name: string) => new Promise<number>((resolve) => spawn(join(HOME, "bin", "cargo"), [name], { env, stdio: "ignore" }).on("close", (code) => resolve(code ?? 1)));
  const codes = await Promise.all([run("one"), run("two")]);
  assert.deepEqual(codes, [0, 0]);
  const lines = readFileSync(log, "utf8").trim().split("\n");
  assert.equal(lines.length, 4);
  // With the lock, the second start comes after the first end.
  assert.equal(lines[0]!.split(" ")[0], "start");
  assert.equal(lines[1]!.split(" ")[0], "end");
  assert.equal(lines[2]!.split(" ")[0], "start");
  assert.equal(lines[3]!.split(" ")[0], "end");
});
