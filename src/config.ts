import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Limits, Project, ProjectConfig } from "./types.ts";

export const HOME = dirname(dirname(fileURLToPath(import.meta.url)));

const DEFAULT_LIMITS: Limits = {
  itemTimeout: 2700,
  gateTimeout: 1800,
  maxItemFails: 3,
  maxItemsPerRound: 24,
  qualityEvery: 3,
  maxRounds: 30,
  checkpointEvery: 0,
  backoffStart: 60,
  backoffMax: 1800,
  maxRateRetries: 100,
  niceLevel: 10,
};

/** Environment overrides: RALPH_ITEM_TIMEOUT=600 etc. for every limit, plus RALPH_REPO, RALPH_RUNS_DIR, RALPH_CLAUDE. */
function limitsFor(config: ProjectConfig): Limits {
  const limits: Limits = { ...DEFAULT_LIMITS, ...config.limits };
  for (const key of Object.keys(limits) as (keyof Limits)[]) {
    const env = process.env[`RALPH_${key.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase()}`];
    if (env !== undefined && env !== "") limits[key] = Number(env);
  }
  return limits;
}

export function resolveProject(name: string, config: ProjectConfig, projectDir: string): Project {
  const repo = process.env.RALPH_REPO ?? config.repo;
  const runsDir = process.env.RALPH_RUNS_DIR ?? join(HOME, "runs", name);
  const areas = Object.keys(config.areas);
  if (areas.length === 0) throw new Error(`${name}: config.areas is empty`);
  return {
    name,
    home: HOME,
    projectDir,
    repo,
    baseBranch: config.baseBranch ?? "main",
    loopDir: config.loopDir ?? "ralph",
    rulesFile: config.rulesFile ?? "CLAUDE.md",
    areas,
    config,
    integrationFiles: config.integrationFiles,
    itemCheck: config.itemCheck ?? "",
    fullCheck: config.fullCheck ?? "",
    qualityCmd: config.qualityCmd ?? "",
    skeletonStep: config.skeletonStep ?? true,
    env: config.env ?? {},
    claudeCmd: (process.env.RALPH_CLAUDE ?? "claude").split(" ").filter(Boolean),
    claudeModel: config.claudeModel ?? "",
    commitTrailer: config.commitTrailer ?? "Co-Authored-By: Claude <noreply@anthropic.com>",
    limits: limitsFor(config),
    skipGate: Boolean(process.env.RALPH_SKIP_GATE),
    runsDir,
    stateDir: join(runsDir, "state"),
    worktreesDir: join(runsDir, "worktrees"),
    integrationDir: join(runsDir, "integration"),
    integrationBranch: "ralph/integration",
    docker: {
      image: config.docker?.image ?? "ralph-base",
      cpus: config.docker?.cpus ?? 6,
      memory: config.docker?.memory ?? "9g",
      network: config.docker?.network,
      mounts: config.docker?.mounts ?? [],
    },
  };
}

export function projectNames(): string[] {
  const dir = join(HOME, "projects");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "project.config.ts")))
    .map((d) => d.name);
}

export async function loadProject(name: string): Promise<Project> {
  const projectDir = join(HOME, "projects", name);
  const file = join(projectDir, "project.config.ts");
  if (!existsSync(file)) throw new Error(`no such project: ${name} (ralph list)`);
  const mod = (await import(pathToFileURL(file).href)) as { default: ProjectConfig };
  return resolveProject(name, mod.default, projectDir);
}
