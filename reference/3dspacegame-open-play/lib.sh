# Helpers shared by worker.sh and orchestrator.sh. Source it, do not run it.
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
mkdir -p "$STATE_DIR/logs"

log() { printf '%s [%s] %s\n' "$(date '+%F %T')" "${LOG_TAG:-ralph}" "$*" | tee -a "$STATE_DIR/ralph.log" >&2; }

has_open() { grep -q '^- \[ \]' "$1" 2>/dev/null; }
first_open() { grep -m1 '^- \[ \]' "$1" 2>/dev/null; }
count_open() { grep -c '^- \[ \]' "$1" 2>/dev/null || true; }

# Fill {{NAME}} placeholders in a prompt file from the P_<NAME> variables.
render_prompt() {
  local text
  text=$(<"$RALPH_DIR/prompts/$1.md")
  text=${text//'{{AREA}}'/${P_AREA:-}}
  text=${text//'{{ROUND}}'/${P_ROUND:-}}
  text=${text//'{{STATE_DIR}}'/$STATE_DIR}
  text=${text//'{{BRANCHES}}'/$MERGE_BRANCHES}
  text=${text//'{{GATE_OUTPUT}}'/${P_GATE_OUTPUT:-}}
  printf '%s' "$text"
}

# run_claude <dir> <prompt> <logfile>: one headless session. Retries with backoff on rate-limit errors.
run_claude() {
  local dir=$1 prompt=$2 logfile=$3 delay=$BACKOFF_START tries=0 out status
  while :; do
    out=$(cd "$dir" && timeout "$ITEM_TIMEOUT" $CLAUDE_BIN -p "$prompt" --dangerously-skip-permissions 2>&1)
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

# The repo's "before finishing" checks from CLAUDE.md. Output goes to $GATE_OUTPUT.
run_gate() {
  local dir=$1
  [[ -n "${RALPH_SKIP_GATE:-}" ]] && { GATE_OUTPUT=""; return 0; }
  GATE_OUTPUT=$(
    cd "$dir" || exit 1
    set -e
    cargo fmt
    python3 scripts/check_spacing.py --fix
    cargo build 2>&1
    cargo test 2>&1
    cargo clippy --all-targets -- -D warnings 2>&1
  ) 2>&1
  local status=$?
  GATE_OUTPUT=$(tail -n 60 <<<"$GATE_OUTPUT")
  return $status
}

commit_if_dirty() { # <dir> <message>
  git -C "$1" add -A
  git -C "$1" diff --cached --quiet || git -C "$1" commit -q -m "$2

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
}
