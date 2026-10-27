import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Project } from "./types.ts";
import { branchOf, ownsOf } from "./areas.ts";

export interface PromptVars {
  area?: string;
  round?: number;
  gateOutput?: string;
}

/** Fill {{NAME}} placeholders. A project may override any prompt in projects/<name>/prompts/. */
export function renderPrompt(p: Project, name: string, vars: PromptVars = {}): string {
  const own = join(p.projectDir, "prompts", `${name}.md`);
  let text = readFileSync(existsSync(own) ? own : join(p.home, "prompts", `${name}.md`), "utf8");
  const none = "(none configured: run the repo's own checks)";
  const branches = p.areas.map((a) => branchOf(p, a));
  // Commands first: they may contain {{AREA}} themselves.
  const values: [string, string][] = [
    ["ITEM_CHECK", p.itemCheck || none],
    ["FULL_CHECK", p.fullCheck || none],
    ["QUALITY_CMD", p.qualityCmd || "none"],
    ["AREA", vars.area ?? ""],
    ["ROUND", String(vars.round ?? "")],
    ["OWNS", (vars.area && ownsOf(p, vars.area)?.source) || "(see CONTRACTS.md)"],
    ["PROJECT", p.name],
    ["LOOP_DIR", p.loopDir],
    ["RULES_FILE", p.rulesFile],
    ["STATE_DIR", p.stateDir],
    ["BASE_BRANCH", p.baseBranch],
    ["BRANCHES", branches.join(", ")],
    ["BRANCHES_CSV", branches.join(",")],
    ["AREAS_CSV", p.areas.join(",")],
    ["GATE_OUTPUT", vars.gateOutput ?? ""],
  ];
  for (const [key, value] of values) text = text.replaceAll(`{{${key}}}`, () => value);
  return text;
}
