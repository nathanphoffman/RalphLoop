#!/usr/bin/env bash
# orchestrator.sh: the single loop. Round 0 builds the skeleton, then each round:
# workers in parallel -> merge into main -> checks -> progress + next tasks -> sync worktrees.
set -u
source "$(dirname "$0")/lib.sh"
LOG_TAG=orchestrator
cd "$MAIN_DIR" || exit 1

pids=()
trap 'log "interrupted"; kill "${pids[@]}" 2>/dev/null; exit 130' INT TERM

claude_in() { # <dir> <prompt-name> <round>
  P_ROUND=$3 P_AREA=""
  run_claude "$1" "$(render_prompt "$2")" "$STATE_DIR/logs/round-$3-$2.log"
}
claude_main() { claude_in "$MAIN_DIR" "$1" "$2"; } # <prompt-name> <round>

# Run the checks on main; on failure ask Claude to fix, up to 3 times.
ensure_green() { # <round> [dir, default main]
  local attempt dir=${2:-$MAIN_DIR}
  for attempt in 1 2 3; do
    run_gate "$dir" && { commit_if_dirty "$dir" "ralph: formatting after round $1"; return 0; }
    log "checks failed in $(basename "$dir") (attempt $attempt)"
    P_GATE_OUTPUT=$GATE_OUTPUT claude_in "$dir" fixbuild "$1"
  done
  run_gate "$dir"
}

# Rounds are merged in a separate worktree on branch "integration", so main only ever moves to a commit that passed.
prepare_integration() {
  if [[ ! -d "$INTEGRATION_DIR" ]]; then
    git worktree prune
    git worktree add -q -B "$INTEGRATION_BRANCH" "$INTEGRATION_DIR" main
  else
    git -C "$INTEGRATION_DIR" reset -q --hard main
    git -C "$INTEGRATION_DIR" clean -qfd
  fi
}

advance_main() { # fast-forward main to integration (a plain merge if you committed to main meanwhile)
  git -C "$MAIN_DIR" merge -q --ff-only "$INTEGRATION_BRANCH" 2>/dev/null ||
    git -C "$MAIN_DIR" merge -q --no-edit "$INTEGRATION_BRANCH"
}

# Move each worktree onto main. Merged branches are just fast-forwarded; others are rebased.
sync_worktrees() {
  local area dir
  for area in "${AREAS[@]}"; do
    dir=$(wt_dir "$area")
    if git -C "$dir" merge-base --is-ancestor HEAD main; then
      git -C "$dir" reset -q --hard main
    elif ! git -C "$dir" rebase -q main; then
      git -C "$dir" rebase --abort
      log "WARNING: $area could not be rebased onto main, left as is"
    fi
  done
}

preflight() {
  [[ "$(git branch --show-current)" == main ]] || { log "main repo is not on branch main"; exit 1; }
  git ls-files --error-unmatch ralph/SPEC.md >/dev/null 2>&1 || { log "ralph/ is not committed yet: run ralph/start.sh"; exit 1; }
  [[ -z "$(git status --porcelain)" ]] || { log "main has uncommitted changes, commit or stash first"; exit 1; }
}

preflight
if [[ ! -f "$STATE_DIR/round0-done" ]]; then
  log "round 0: skeleton"
  claude_main round0 0
  ensure_green 0 || { log "round 0 does not build, stopping"; exit 1; }
  sync_worktrees
  touch "$STATE_DIR/round0-done"
fi

round=${RALPH_START_ROUND:-1}
while [[ ! -f "$STATE_DIR/COMPLETE" ]]; do
  (( round > MAX_ROUNDS )) && { log "reached MAX_ROUNDS ($MAX_ROUNDS), stopping"; exit 3; }
  log "===== round $round ====="
  rm -f "$STATE_DIR"/done-*

  pids=()
  for area in "${AREAS[@]}"; do
    RALPH_ROUND=$round "$RALPH_DIR/worker.sh" "$area" >> "$STATE_DIR/logs/round-$round-$area.log" 2>&1 &
    pids+=($!)
  done
  wait "${pids[@]}"
  for area in "${AREAS[@]}"; do
    [[ -f "$STATE_DIR/done-$area" ]] || log "WARNING: $area worker did not finish cleanly, merging what it committed"
  done

  prepare_integration
  claude_in "$INTEGRATION_DIR" merge "$round"
  ensure_green "$round" "$INTEGRATION_DIR"
  green=$?

  claude_in "$INTEGRATION_DIR" plan "$round"
  commit_if_dirty "$INTEGRATION_DIR" "ralph: round $round progress and next tasks"

  # COMPLETE only counts if the result builds and passes.
  if [[ -f "$STATE_DIR/COMPLETE" ]] && ! run_gate "$INTEGRATION_DIR"; then
    log "COMPLETE was claimed but the result is red, removing it"
    rm -f "$STATE_DIR/COMPLETE"
    green=1
  fi

  if (( green != 0 )); then
    log "round $round is still red after fixing attempts: main was NOT updated. Look at branch $INTEGRATION_BRANCH in $INTEGRATION_DIR, then restart."
    exit 4
  fi
  advance_main || { log "could not move main to $INTEGRATION_BRANCH"; exit 5; }

  sync_worktrees
  rm -f "$STATE_DIR"/done-*

  if [[ ! -f "$STATE_DIR/COMPLETE" ]]; then
    open=0
    for area in "${AREAS[@]}"; do open=$((open + $(count_open "ralph/tasks/$area.md"))); done
    (( open == 0 )) && { log "no open tasks and no COMPLETE: planner stalled, stopping"; exit 2; }
  fi
  round=$((round + 1))
done
log "COMPLETE"
