import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOME, loadProject, projectNames } from "./config.ts";
import { dockerBuild, dockerShell, dockerStart, dockerStop } from "./docker.ts";
import { dryrun } from "./dryrun.ts";
import { init } from "./init.ts";
import { runOrchestrator } from "./orchestrator.ts";
import { report } from "./report.ts";
import { setup } from "./setup.ts";
import { isRunning, status } from "./status.ts";

const USAGE = `ralph init <name> <repo> [area...]   create projects/<name>/ and <repo>/ralph/ from the templates
ralph setup <name>                   commit the loop files, create the worktrees (safe to repeat)
ralph start <name> --host            setup + run in the background ON THIS MACHINE (no sandbox)
ralph run <name>                     setup + run in the foreground (what the container runs)
ralph stop <name>                    stop the loop and any Claude sessions it started
ralph status [name]                  items per area, round, ETA, last log lines
ralph log <name> [-f]                show (or follow) the loop log
ralph report <name>                  write and print a markdown report
ralph dryrun [dir]                   run the whole loop on a toy repo with a fake claude
ralph list                           projects
ralph docker build [rust]            build the sandbox image (ralph-base, or ralph-rust on top of it)
ralph docker start|stop|shell <name> run the loop (or a shell) inside the sandbox`;

const [cmd = "help", ...args] = process.argv.slice(2);

async function main(): Promise<number> {
  const need = (i: number, what = "project name"): string => {
    const v = args[i];
    if (!v) throw new Error(`missing ${what}\n\n${USAGE}`);
    return v;
  };
  const project = () => loadProject(need(0));

  switch (cmd) {
    case "help": case "-h": case "--help":
      console.log(USAGE);
      return 0;
    case "list":
      console.log(projectNames().join("\n"));
      return 0;
    case "init":
      console.log(init(need(0), need(1, "repo path"), args.slice(2)).join("\n"));
      return 0;
    case "setup":
      console.log(setup(await project()).join("\n"));
      return 0;
    case "run": {
      const p = await project();
      console.log(setup(p).join("\n"));
      return runOrchestrator(p);
    }
    case "start": {
      const p = await project();
      if (args[1] !== "--host") {
        console.log(`This runs Claude with --dangerously-skip-permissions as you, with no sandbox.\nUse 'ralph docker start ${p.name}' instead, or add --host if you accept that.`);
        return 1;
      }
      if (isRunning(p)) {
        console.log("already running");
        return 1;
      }
      console.log(setup(p).join("\n"));
      const out = openSync(join(p.stateDir, "stdout.log"), "a");
      spawn(process.execPath, [join(HOME, "src", "cli.ts"), "run", p.name], { detached: true, stdio: ["ignore", out, out] }).unref();
      closeSync(out);
      console.log(`started (log: ralph log ${p.name} -f)`);
      return 0;
    }
    case "stop": {
      const p = await project();
      const pid = isRunning(p);
      if (!pid) {
        console.log(`not running (on host). In Docker use: ralph docker stop ${p.name}`);
        return 1;
      }
      try {
        process.kill(-pid, "SIGTERM"); // started by 'ralph start': it leads its own process group, so Claude sessions go too
      } catch {
        process.kill(pid, "SIGTERM"); // started in the foreground: it kills its own children
      }
      console.log("stopped");
      return 0;
    }
    case "status":
      if (args[0]) console.log(status(await loadProject(args[0])));
      else for (const name of projectNames()) console.log(status(await loadProject(name), 0) + "\n");
      return 0;
    case "log": {
      const p = await project();
      const file = join(p.stateDir, "ralph.log");
      if (!existsSync(file)) {
        console.log("(no log yet)");
        return 1;
      }
      if (args[1] === "-f") return new Promise((resolve) => spawn("tail", ["-n", "30", "-F", file], { stdio: "inherit" }).on("close", () => resolve(0)));
      console.log(readFileSync(file, "utf8").split("\n").slice(-61).join("\n"));
      return 0;
    }
    case "report":
      console.log(report(await project()));
      return 0;
    case "dryrun":
      return dryrun(args[0]);
    case "docker":
      switch (args[0]) {
        case "build": return dockerBuild(args[1] === "rust");
        case "start": args.shift(); return dockerStart(await project());
        case "stop": args.shift(); return dockerStop(await project());
        case "shell": args.shift(); return dockerShell(await project());
        default: throw new Error(`unknown docker command\n\n${USAGE}`);
      }
    default:
      console.log(USAGE);
      return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  },
);
