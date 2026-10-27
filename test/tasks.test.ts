import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { count, DONE, firstOpen, hasOpen, markBlocked, OPEN } from "../src/tasks.ts";

const file = () => {
  const f = join(mkdtempSync(join(tmpdir(), "ralph-t-")), "a.md");
  writeFileSync(f, "# a\n\n- [x] one\n- [ ] two $& (x)\n- [ ] three\n");
  return f;
};

test("finds and counts items", () => {
  const f = file();
  assert.equal(firstOpen(f), "- [ ] two $& (x)");
  assert.ok(hasOpen(f));
  assert.equal(count(f, OPEN), 2);
  assert.equal(count(f, DONE), 1);
});

test("markBlocked changes only the named line, with no regex surprises", () => {
  const f = file();
  markBlocked(f, "- [ ] two $& (x)", 3);
  assert.equal(readFileSync(f, "utf8"), "# a\n\n- [x] one\n- [!] (blocked after 3 failed tries) two $& (x)\n- [ ] three\n");
});

test("missing file has no open items", () => {
  assert.equal(hasOpen("/nonexistent/file.md"), false);
});
