import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveProject } from "../src/config.ts";
import { renderPrompt } from "../src/prompts.ts";

const p = resolveProject(
  "t",
  {
    repo: "/tmp/none",
    areas: { world: { owns: /^src\/world\// }, ui: { branch: "work-ui" } },
    itemCheck: "test {{AREA}} && echo $HOME & done",
    fullCheck: "make all",
  },
  "/tmp/none-project",
);

test("worker prompt fills area, round, owns and the item check (with its own {{AREA}})", () => {
  const text = renderPrompt(p, "worker", { area: "world", round: 3 });
  assert.match(text, /^\[ralph:worker area=world round=3\]/);
  assert.match(text, /test world && echo \$HOME & done/);
  assert.match(text, /pattern: \^src\\\/world\\\//);
  assert.doesNotMatch(text, /\{\{/);
});

test("merge prompt lists branches in area order, and the header carries them for the fake claude", () => {
  const text = renderPrompt(p, "merge", { round: 1 });
  assert.match(text, /branches=ralph\/world,work-ui\]/);
  assert.match(text, /ralph\/world, work-ui/);
});

test("fixbuild passes gate output through untouched", () => {
  assert.match(renderPrompt(p, "fixbuild", { round: 1, gateOutput: "error: $1 `x` {{AREA}}" }), /error: \$1 `x` \{\{AREA\}\}/);
});

test("every shipped prompt renders without leftover placeholders", () => {
  for (const name of ["worker", "quality", "merge", "plan", "fixbuild", "round0"]) {
    assert.doesNotMatch(renderPrompt(p, name, { area: "world", round: 1 }), /\{\{/, name);
  }
});
