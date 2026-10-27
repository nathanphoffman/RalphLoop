import { join } from "node:path";
import type { Project } from "./types.ts";

export const worktreeOf = (p: Project, area: string): string => p.config.areas[area]?.worktree ?? join(p.worktreesDir, area);
export const branchOf = (p: Project, area: string): string => p.config.areas[area]?.branch ?? `ralph/${area}`;
export const ownsOf = (p: Project, area: string): RegExp | undefined => p.config.areas[area]?.owns;
