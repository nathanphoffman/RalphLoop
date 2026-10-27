import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { dryrun } from "../src/dryrun.ts";

test("whole loop runs to COMPLETE on a toy repo with a fake claude", async () => {
  const log = console.log;
  const lines: string[] = [];
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  const err = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    const code = await dryrun(join(mkdtempSync(join(tmpdir(), "ralph-e2e-")), "sb"));
    assert.equal(code, 0, lines.join("\n"));
  } finally {
    console.log = log;
    process.stderr.write = err;
  }
});
