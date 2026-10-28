# SolarBit Ralph Loop — Draft Plan

Status: draft, still thinking. Nothing has been built yet.
Target repo: `~/Code/SolarBitInfrastructure`

## Is it a good fit for a Ralph loop?

Yes, as long as the loop uses fakes for part of it.

- The pieces already sit behind clients (`Shared/Nomad`, `Shared/Caddy`, `Shared/Redis`), so fakes can go at those points.
- `TODO.txt` is already a list of loop-sized tasks.
- Redis and Mongo can run for real inside the loop container.
- **Needs fakes:** Docker builds, Nomad, Caddy. Nomad needs root and cgroups, which the sandbox doesn't allow.
- **What fakes can't catch:** host problems like the ones in the two test debriefs (cgroup v2 needing root, sudo prompting in the background, pkill killing `just`). Do a real deploy test on the real machine between rounds.

## Prep work before starting

- The repo has no tests. Round 0 adds a test project for C# and Go.
- Delete the old Rust DockerMonitor (`Cargo.toml`, `src/`, `target/`) next to the Go one. (Not yet confirmed with Nate.)
- `.env` is gitignored but sits in the folder the container mounts, so Claude could see it. Only the variable names were checked and they looked like local URLs. Double-check there are no secrets.

## What exists today

- The API has 4 endpoints: list customers, get one customer, detect a repo's build config, start a build.
- No login. `GET /customers` returns every customer to anyone.
- Mongo models exist: customers (with Stripe fields), plans, projects, env vars, build events, usage records.
- Env var values are stored as plain text, even though a code comment says they should be encrypted.

## What we're building

Two web apps plus the backend work they need.

### Areas

- **api:** GitHub login, project and env-var endpoints (encrypted), deploy history and status, usage, admin-only endpoints. Publishes an OpenAPI description so the UIs get typed clients.
- **platform:** DockerManager and DockerMonitor emit deploy status, build logs and usage into Redis. The `TODO.txt` items go here too.
- **customer-ui:** projects, deploy button and history, live status and logs, env vars, custom domain, plan and usage, account page.
- **admin-ui:** cluster health, running services, failed or stuck deploys, customers and their usage, actions like redeploy and stop.

### Decisions made

1. **Login:** customers must use "Sign in with GitHub" in v1.
2. **Billing:** v1 only shows plan and usage. Build the Stripe scaffolding but don't take payments.
3. **Screens:** the list above is good for v1.
4. **Tech:** TypeScript + Next.js for both UIs.

### Still open

- Admin tool: just Nate with a single login? (Not answered yet.)

### Order

- **Round 0:** tests, an API contract, and a mock API so the UIs can be built without the backend.
- Security first: login and encrypted env vars come before any screens.

## Gaps found in the infrastructure code

### Needed for the UIs to work

- **Deploy status:** nothing records whether a build or deploy succeeded, failed or is running. Build logs aren't saved (`BuildEventProcessor` only logs to console). Includes the unwired health check and the missing "did the container actually start" check from the debriefs.
- **Env vars:** stored in Mongo but `NomadJobBuilder` never passes them into the job.
- **Stop, redeploy, rollback, delete:** `NomadClient` can stop a job but no endpoint calls it.
- **Usage:** nothing writes `usage_records`.
- **Auto-deploy on push:** the overview says a push triggers a deploy, but there's no webhook code. Deploys only start from a manual API call.

### Needed before real customers

- **Name collisions:** the customer-chosen app name is used directly as the Nomad job ID and Caddy route, so one customer could overwrite another's app.
- **Input checking:** repo URL and branch go straight into the `git clone` command line (option injection risk).
- **Private repos:** no GitHub token for cloning them. GitHub login would provide one.
- **Build limits:** customer code builds on the host Docker with no timeouts, size caps or per-plan limits on number of apps.
- **Cleanup:** old registry images and old build folders are never removed.

### Already in TODO.txt, still worth doing

- Wire the health check into `NomadJobBuilder`
- Registry behind Caddy with real TLS
- Redis robustness (AOF, Sentinel) and reconcile `services:running` on DockerMonitor startup
- Service name namespacing
- Rewrite the seeder for the real collections
- V2: multi-datacenter (not needed yet)

## Proposed next steps

1. Decide whether the "needed for the UIs" gaps go in as platform work before the UIs, and the "before real customers" gaps as a security round.
2. Answer the open admin-login question.
3. Draft `SPEC.md` and the API contracts.
