// Step 1 of the TypeScript move: the CLI is TypeScript, the engine is still the shell scripts.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const home = dirname(dirname(fileURLToPath(import.meta.url)));
const result = spawnSync(join(home, "engine", "ralph.sh"), process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
