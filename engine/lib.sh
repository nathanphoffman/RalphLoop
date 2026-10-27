# Helpers shared by every engine script. Source it, do not run it.
# Needs RALPH_PROJECT (the folder name under projects/). Every setting can be overridden from the environment.
ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_HOME="$(dirname "$ENGINE_DIR")"
: "${RALPH_PROJECT:?RALPH_PROJECT is not set}"
PROJECT_DIR="${PROJECT_DIR:-$RALPH_HOME/projects/$RALPH_PROJECT}"
[[ -f "$PROJECT_DIR/project.conf" ]] || { echo "no project.conf in $PROJECT_DIR" >&2; exit 1; }

# Per-area tables the project.conf fills in (AREA_OWNS[world]='^src/world/', ...).
declare -A AREA_OWNS=() AREA_WORKTREE=() AREA_BRANCH=()
AREAS=(main)
source "$PROJECT_DIR/project.conf"

REPO="${RALPH_REPO:-${REPO:?project.conf must set REPO}}"
BASE_BRANCH="${BASE_BRANCH:-main}"
LOOP_DIR="${LOOP_DIR:-ralph}" # folder inside the repo holding SPEC.md, CONTRACTS.md, tasks/ ...
RULES_FILE="${RULES_FILE:-CLAUDE.md}" # the repo's own coding rules, if it has any
RUNS_DIR="${RALPH_RUNS_DIR:-$RALPH_HOME/runs/$RALPH_PROJECT}"
STATE_DIR="${STATE_DIR:-$RUNS_DIR/state}" # markers, logs, COMPLETE: outside the git repos on purpose
WORKTREES_DIR="${WORKTREES_DIR:-$RUNS_DIR/worktrees}"
INTEGRATION_DIR="${INTEGRATION_DIR:-$RUNS_DIR/integration}" # where rounds are merged and checked
INTEGRATION_BRANCH="${INTEGRATION_BRANCH:-ralph/integration}"
CLAUDE_BIN="${RALPH_CLAUDE:-claude}"
CLAUDE_MODEL="${CLAUDE_MODEL:-}"

ITEM_CHECK="${ITEM_CHECK:-}" # quick check after each item; {{AREA}} is replaced
FULL_CHECK="${FULL_CHECK:-}" # full gate: quality pass, merge, fix-build, end of round
QUALITY_CMD="${QUALITY_CMD:-}" # optional code-quality report command
SKELETON_STEP="${SKELETON_STEP:-1}" # 1 = round 0 builds a skeleton of CONTRACTS.md first
COMMIT_TRAILER="${COMMIT_TRAILER:-Co-Authored-By: Claude <noreply@anthropic.com>}"

ITEM_TIMEOUT="${ITEM_TIMEOUT:-2700}"      # seconds one Claude session may run
GATE_TIMEOUT="${GATE_TIMEOUT:-1800}"      # seconds the check command may run
MAX_ITEM_FAILS="${MAX_ITEM_FAILS:-3}"     # tries on one item before it is marked blocked "- [!]"
MAX_ITEMS_PER_ROUND="${MAX_ITEMS_PER_ROUND:-24}" # safety stop for one worker per round
QUALITY_EVERY="${QUALITY_EVERY:-3}"       # finished items between quality passes (0 = never)
MAX_ROUNDS="${RALPH_MAX_ROUNDS:-30}"
BACKOFF_START="${BACKOFF_START:-60}"      # seconds, doubles up to BACKOFF_MAX
BACKOFF_MAX="${BACKOFF_MAX:-1800}"
MAX_RATE_RETRIES="${MAX_RATE_RETRIES:-100}"
NICE_LEVEL="${NICE_LEVEL:-10}"
RATE_LIMIT_PATTERN='rate.?limit|429|overloaded|usage limit|too many requests|try again later|quota|capacity'

export LOOP_DIR STATE_DIR
mkdir -p "$STATE_DIR/logs"

# --- areas ---------------------------------------------------------------------------------------------
wt_dir() { echo "${AREA_WORKTREE[$1]:-$WORKTREES_DIR/$1}"; }
wt_branch() { echo "${AREA_BRANCH[$1]:-ralph/$1}"; }
join_by() { local sep=$1 out="" x; shift; for x in "$@"; do out+="${out:+$sep}$x"; done; printf '%s' "$out"; }
branch_list() { local a b=(); for a in "${AREAS[@]}"; do b+=("$(wt_branch "$a")"); done; join_by "$1" "${b[@]}"; } # <separator>
tasks_file() { echo "$1/$LOOP_DIR/tasks/$2.md"; } # <checkout-dir> <area>

# --- logging and task files ------------------------------------------------------------------------------
log() { printf '%s [%s] %s\n' "$(date '+%F %T')" "${LOG_TAG:-ralph}" "$*" | tee -a "$STATE_DIR/ralph.log" >&2; }
record_item() { printf '%s\t%s\t%s\t%s\t%s\n' "$(date +%s)" "$1" "$2" "$3" "$4" >> "$STATE_DIR/items.tsv"; } # round area status secs

has_open() { grep -q '^- \[ \]' "$1" 2>/dev/null; }
first_open() { grep -m1 '^- \[ \]' "$1" 2>/dev/null; }
count_open() { grep -c '^- \[ \]' "$1" 2>/dev/null || true; }
count_done() { grep -c '^- \[x\]' "$1" 2>/dev/null || true; }
count_blocked() { grep -c '^- \[!\]' "$1" 2>/dev/null || true; }

# --- prompts ---------------------------------------------------------------------------------------------
# Fill {{NAME}} placeholders from the P_<NAME> variables. A project may override any prompt in projects/<name>/prompts/.
render_prompt() {
  local file="$PROJECT_DIR/prompts/$1.md" text owns none="(none configured: run the repo's own checks)"
  [[ -f "$file" ]] || file="$ENGINE_DIR/prompts/$1.md"
  text=$(<"$file")
  # Commands first: they may contain {{AREA}} themselves.
  text=${text//'{{ITEM_CHECK}}'/"${ITEM_CHECK:-$none}"}
  text=${text//'{{FULL_CHECK}}'/"${FULL_CHECK:-$none}"}
  text=${text//'{{QUALITY_CMD}}'/"${QUALITY_CMD:-none}"}
  text=${text//'{{AREA}}'/"${P_AREA:-}"}
  text=${text//'{{ROUND}}'/"${P_ROUND:-}"}
  owns="(see CONTRACTS.md)"
  [[ -n "${P_AREA:-}" ]] && owns=${AREA_OWNS[$P_AREA]:-$owns}
  text=${text//'{{OWNS}}'/"$owns"}
  text=${text//'{{PROJECT}}'/"$RALPH_PROJECT"}
  text=${text//'{{LOOP_DIR}}'/"$LOOP_DIR"}
  text=${text//'{{RULES_FILE}}'/"$RULES_FILE"}
  text=${text//'{{STATE_DIR}}'/"$STATE_DIR"}
  text=${text//'{{BASE_BRANCH}}'/"$BASE_BRANCH"}
  text=${text//'{{BRANCHES}}'/"$(branch_list ", ")"}
  text=${text//'{{BRANCHES_CSV}}'/"$(branch_list ,)"}
  text=${text//'{{AREAS_CSV}}'/"$(join_by , "${AREAS[@]}")"}
  text=${text//'{{GATE_OUTPUT}}'/"${P_GATE_OUTPUT:-}"}
  printf '%s' "$text"
}

# run_claude <dir> <prompt> <logfile>: one headless session. Retries with backoff on rate-limit errors.
run_claude() {
  local dir=$1 prompt=$2 logfile=$3 delay=$BACKOFF_START tries=0 out status args
  args=(-p "$prompt" --dangerously-skip-permissions)
  [[ -n "$CLAUDE_MODEL" ]] && args+=(--model "$CLAUDE_MODEL")
  while :; do
    out=$(cd "$dir" && nice -n "$NICE_LEVEL" timeout "$ITEM_TIMEOUT" "$CLAUDE_BIN" "${args[@]}" 2>&1)
    status=$?
    printf '%s\n' "$out" >> "$logfile"
    if (( status != 0 )) && grep -qiE "$RATE_LIMIT_PATTERN" <<<"$out" && (( tries < MAX_RATE_RETRIES )); then
      tries=$((tries + 1))
      log "rate limited (try $tries), sleeping ${delay}s"
      sleep "$delay"
      delay=$(( delay * 2 > BACKOFF_MAX ? BACKOFF_MAX : delay * 2 ))
      continue
    fi
    return "$status"
  done
}

# --- checks ----------------------------------------------------------------------------------------------
# run_check <dir> <command>: output (last 60 lines) lands in $GATE_OUTPUT. An empty command always passes.
run_check() {
  local dir=$1 cmd=$2 status
  if [[ -n "${RALPH_SKIP_GATE:-}" || -z "$cmd" ]]; then GATE_OUTPUT=""; return 0; fi
  GATE_OUTPUT=$(cd "$dir" && nice -n "$NICE_LEVEL" timeout "$GATE_TIMEOUT" bash -ec "$cmd" 2>&1)
  status=$?
  GATE_OUTPUT=$(tail -n 60 <<<"$GATE_OUTPUT")
  return $status
}
run_gate() { run_check "$1" "$FULL_CHECK"; } # <dir>

commit_if_dirty() { # <dir> <message>
  git -C "$1" add -A
  git -C "$1" diff --cached --quiet || git -C "$1" commit -q -m "$2

$COMMIT_TRAILER"
}
