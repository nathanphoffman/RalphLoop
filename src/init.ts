import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { HOME } from "./config.ts";

/** Scaffold projects/<name>/project.config.ts and <repo>/ralph/ from the templates. */
export function init(name: string, repoArg: string, areasArg: string[]): string[] {
  const repo = resolve(repoArg);
  const areas = areasArg.length ? areasArg : ["main"];
  if (!existsSync(join(repo, ".git"))) throw new Error(`${repo} is not a git repo`);
  const projectDir = join(HOME, "projects", name);
  if (existsSync(projectDir)) throw new Error(`projects/${name} already exists`);
  const out: string[] = [];

  mkdirSync(projectDir, { recursive: true });
  const areaLines = areas.map((a) => `    ${a}: { owns: /^src\\/${a}\\// },`).join("\n");
  const conf = readFileSync(join(HOME, "templates", "project", "project.config.ts.tmpl"), "utf8")
    .replace("@REPO@", repo)
    .replace("@AREAS@", areaLines);
  writeFileSync(join(projectDir, "project.config.ts"), conf);

  const loop = join(repo, "ralph");
  if (existsSync(loop)) out.push(`note: ${loop} already exists, left alone`);
  else {
    const templates = join(HOME, "templates", "loop");
    mkdirSync(join(loop, "tasks"), { recursive: true });
    for (const f of readdirSync(templates).filter((f) => f.endsWith(".md"))) cpSync(join(templates, f), join(loop, f));
    const task = readFileSync(join(templates, "tasks", "AREA.md"), "utf8");
    for (const a of areas) writeFileSync(join(loop, "tasks", `${a}.md`), task.replaceAll("AREA", a));
  }
  out.push(
    `Created projects/${name}/project.config.ts and ${loop}/.`,
    `Next: fill in ${loop}/SPEC.md + CONTRACTS.md, set the checks in project.config.ts, then: ralph dryrun && ralph docker start ${name}`,
  );
  return out;
}
