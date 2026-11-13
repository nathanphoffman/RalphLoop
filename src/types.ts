// Shapes of a project config (what you write) and the resolved project (what the engine uses).

export interface AreaConfig {
  /** Files this area may change (regex on repo-relative paths). Edits outside are logged, never reverted. */
  owns?: RegExp;
  /** Use an existing worktree folder instead of runs/<name>/worktrees/<area>. */
  worktree?: string;
  /** Branch for the area (default ralph/<area>). */
  branch?: string;
}

/** All times in seconds. */
export interface Limits {
  itemTimeout: number; // one Claude session
  gateTimeout: number; // one check command
  minItemSeconds: number; // a session that ends sooner without ticking its item is retried (0 = never)
  maxEarlyRetries: number; // such retries per item
  maxItemFails: number; // tries on one item before it is marked blocked
  groupItemsTarget: number; // the planner aims to chain related items in groups of about this many (1 = no preference); never forced
  maxItemsPerContext: number; // items one Claude context may serve; an item tagged (continues previous) resumes it (1 = always fresh)
  maxItemsPerRound: number; // safety stop for one worker per round
  qualityEvery: number; // finished items between quality passes (0 = never)
  maxRounds: number;
  checkpointEvery: number; // pause after every N rounds so the user can test (0 = never)
  checkpointWaitMinutes: number; // at a checkpoint: wait for the user at most N minutes, then go on (0 = no limit)
  backoffStart: number; // rate limit backoff, doubles up to backoffMax
  backoffMax: number;
  maxRateRetries: number;
  niceLevel: number;
}

export interface ProjectConfig {
  /** The git repo the loop builds in (must be on baseBranch and clean). */
  repo: string;
  baseBranch?: string; // default main
  /** Branch the round merges on (default ralph/integration). Give each project in one repo its own. */
  integrationBranch?: string;
  /** Put each round on the base branch as ONE squashed commit instead of every item commit (default false). */
  squashRounds?: boolean;
  loopDir?: string; // folder in the repo with SPEC.md, CONTRACTS.md, tasks/ (default ralph)
  rulesFile?: string; // the repo's own coding rules, read by workers if present (default CLAUDE.md)
  /** Areas run in parallel in their own worktrees. Object order is the merge order. */
  areas: Record<string, AreaConfig>;
  /** Shared files anyone may touch without an ownership warning. */
  integrationFiles?: RegExp;
  /** Quick check after every item. "{{AREA}}" is replaced. Run with `bash -e` in the checkout. Empty = none. */
  itemCheck?: string;
  /** Full gate: quality pass, merge, fix-build, end of round. */
  fullCheck?: string;
  /** Optional report command for the quality pass. */
  qualityCmd?: string;
  /** Round 0 builds a skeleton of the CONTRACTS.md interfaces first (default true). */
  skeletonStep?: boolean;
  /** Extra environment for Claude and the checks, e.g. { CARGO_BUILD_JOBS: "3" }. */
  env?: Record<string, string>;
  /** One build pipeline: every `cargo` the checks or a Claude session runs goes through bin/cargo, a shim that takes a
   *  file lock (runs/<name>/state/build.lock), so parallel areas never build at the same time (default false). */
  buildLock?: boolean;
  /** With buildLock: how many cargo commands may run at once (default 1). Give each one CARGO_BUILD_JOBS = threads / this. */
  buildPipelines?: number;
  /** Housekeeping between rounds: `cmd` runs (with the project env, through bin/cargo when buildLock is on) in every
   *  area worktree and the integration checkout after every `everyRounds`-th round, e.g.
   *  { everyRounds: 2, cmd: "cargo clean -p my_crate" } drops the crate's incremental cache (gigabytes per worktree)
   *  and keeps the compiled dependencies. Default: never. */
  cleanup?: { everyRounds: number; cmd: string };
  claudeModel?: string;
  commitTrailer?: string;
  limits?: Partial<Limits>;
  docker?: {
    image?: string; // default ralph-base
    cpus?: number;
    memory?: string;
    network?: string;
    mounts?: string[]; // extra folders mounted at the same path
  };
}

export interface Project {
  name: string;
  home: string; // the RalphLoops checkout
  projectDir: string; // projects/<name>
  repo: string;
  baseBranch: string;
  loopDir: string;
  rulesFile: string;
  areas: string[];
  config: ProjectConfig;
  integrationFiles?: RegExp;
  itemCheck: string;
  fullCheck: string;
  qualityCmd: string;
  skeletonStep: boolean;
  env: Record<string, string>;
  buildLock: boolean;
  buildPipelines: number;
  cleanup: { everyRounds: number; cmd: string }; // everyRounds 0 = never
  claudeCmd: string[]; // command and leading args, e.g. ["claude"]
  claudeModel: string;
  commitTrailer: string;
  limits: Limits;
  skipGate: boolean;
  runsDir: string;
  stateDir: string;
  worktreesDir: string;
  integrationDir: string;
  integrationBranch: string;
  squashRounds: boolean;
  docker: Required<Pick<NonNullable<ProjectConfig["docker"]>, "image" | "cpus" | "memory">> & {
    network?: string;
    mounts: string[];
  };
}
