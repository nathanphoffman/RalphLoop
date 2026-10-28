import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readQuality } from "./quality.ts";
import { isInDocker, readLines, status } from "./status.ts";
import type { Project } from "./types.ts";

const REFRESH_MILLISECONDS = 3000;
const CLEAR_SCREEN = "\x1b[2J\x1b[H";
const MIN_LOG_LINES = 8;

const BYTES_PER_GB = 1024 ** 3;

/** The container's memory now and its highest so far, from the cgroup files (Linux, Docker with cgroup v2). */
function containerMemory(p: Project): string {
  const id = spawnSync("docker", ["inspect", "-f", "{{.Id}}", `ralph-${p.name}`], { encoding: "utf8" }).stdout.trim();
  if (!id) return "";
  const read = (name: string): number | undefined => {
    const file = `/sys/fs/cgroup/system.slice/docker-${id}.scope/${name}`;
    return existsSync(file) ? Number(readFileSync(file, "utf8")) / BYTES_PER_GB : undefined;
  };
  const now = read("memory.current");
  const peak = read("memory.peak");
  return now === undefined || peak === undefined ? "" : `   memory: ${now.toFixed(1)} GB now, ${peak.toFixed(1)} GB peak (limit ${p.docker.memory})`;
}

/** One screen: where the loop is, the latest scores, and as many recent log lines as fit. */
export function watchScreen(p: Project, rows: number, columns: number): string {
  const head = [
    `ralph watch ${p.name}   ${new Date().toLocaleString("sv")} (local)   container: ${isInDocker(p) ? "UP" : "not running"}${containerMemory(p)}`,
    status(p, 0).replace("\n--- last log lines", ""),
  ];
  const pauseFile = join(p.stateDir, "PAUSE");
  const nextRound = join(p.stateDir, "next-round");
  if (existsSync(pauseFile)) head.push("PAUSE file present: will stop after this round");
  else if (existsSync(nextRound)) head.push(`next round on restart: ${readFileSync(nextRound, "utf8").trim()}   (stops every ${p.limits.checkpointEvery || "never"} rounds)`);

  const scores = readQuality(p).slice(-3);
  if (scores.length) head.push(`quality: ${scores.map((s) => `${s.score} ${s.grade} (r${s.round} ${s.area})`).join("  ->  ")}`);

  const headLines = head.join("\n").split("\n");
  const room = Math.max(MIN_LOG_LINES, rows - headLines.length - 2);
  const logLines = readLines(join(p.stateDir, "ralph.log")).slice(-room);
  return [...headLines, "-".repeat(Math.min(columns, 80)), ...logLines.map((line) => line.slice(0, columns))].join("\n");
}

/** Redraws the screen every few seconds until Ctrl-C. */
export function watch(p: Project): Promise<number> {
  const draw = () => process.stdout.write(CLEAR_SCREEN + watchScreen(p, process.stdout.rows || 40, process.stdout.columns || 120) + "\n");

  draw();
  const timer = setInterval(draw, REFRESH_MILLISECONDS);

  return new Promise((resolve) => {
    process.on("SIGINT", () => {
      clearInterval(timer);
      resolve(0);
    });
  });
}
