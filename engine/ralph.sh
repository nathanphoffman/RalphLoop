#!/usr/bin/env bash
# ralph: one command for every loop. Run `ralph help`.
set -eu
HOME_DIR="$(dirname "$(cd "$(dirname "$(readlink -f "$0")")" && pwd)")"
ENGINE="$HOME_DIR/engine"

usage() {
  cat <<USAGE
ralph init <name> <repo> [area...]   create projects/<name>/ and <repo>/ralph/ from the templates
ralph setup <name>                   commit the loop files, create the worktrees (safe to repeat)
ralph start <name> --host            setup + run in the background ON THIS MACHINE (no sandbox)
ralph run <name>                     setup + run in the foreground (what the container runs)
ralph stop <name>                    stop the loop and any Claude sessions it started
ralph status [name]                  items per area, round, ETA, last log lines
ralph log <name> [-f]                show (or follow) the loop log
ralph report <name>                  write and print a markdown report
ralph dryrun                         run the whole loop on a toy repo with a fake claude
ralph list                           projects
ralph docker build [rust]            build the sandbox image (ralph-base, or ralph-rust on top of it)
ralph docker start|stop|shell <name> run the loop (or a shell) inside the sandbox
USAGE
}

project() { # <name> -> exports RALPH_PROJECT
  [[ -n "${1:-}" ]] || { usage; exit 1; }
  [[ -f "$HOME_DIR/projects/$1/project.conf" ]] || { echo "no such project: $1 (ralph list)"; exit 1; }
  export RALPH_PROJECT=$1
}
state_dir() { (source "$ENGINE/lib.sh" && echo "$STATE_DIR"); }

cmd=${1:-help}; shift || true
case "$cmd" in
  help|-h|--help) usage ;;
  list) ls "$HOME_DIR/projects" ;;
  init)
    name=${1:?usage: ralph init <name> <repo> [area...]}; repo=$(realpath "${2:?usage: ralph init <name> <repo> [area...]}"); shift 2
    areas=("$@"); (( ${#areas[@]} )) || areas=(main)
    [[ -d "$repo/.git" ]] || { echo "$repo is not a git repo"; exit 1; }
    [[ ! -e "$HOME_DIR/projects/$name" ]] || { echo "projects/$name already exists"; exit 1; }
    mkdir -p "$HOME_DIR/projects/$name"
    owns=""; for a in "${areas[@]}"; do owns+="AREA_OWNS[$a]='^src/$a/'"$'\n'; done
    sed -e "s|@REPO@|$repo|" -e "s|@AREAS@|${areas[*]}|" "$HOME_DIR/templates/project/project.conf" |
      awk -v owns="$owns" '/^@OWNS@$/ {printf "%s", owns; next} {print}' > "$HOME_DIR/projects/$name/project.conf"
    if [[ -e "$repo/ralph" ]]; then echo "note: $repo/ralph already exists, left alone"; else
      mkdir -p "$repo/ralph/tasks"
      cp "$HOME_DIR"/templates/loop/*.md "$repo/ralph/"
      for a in "${areas[@]}"; do sed "s/AREA/$a/g" "$HOME_DIR/templates/loop/tasks/AREA.md" > "$repo/ralph/tasks/$a.md"; done
    fi
    echo "Created projects/$name/project.conf and $repo/ralph/."
    echo "Next: fill in $repo/ralph/SPEC.md + CONTRACTS.md, set the checks in project.conf, then: ralph dryrun && ralph docker start $name" ;;
  setup) project "${1:-}"; "$ENGINE/setup.sh" ;;
  run) project "${1:-}"; "$ENGINE/setup.sh"; exec "$ENGINE/orchestrator.sh" ;;
  start)
    project "${1:-}"; [[ "${2:-}" == "--host" ]] || {
      echo "This runs Claude with --dangerously-skip-permissions as you, with no sandbox."
      echo "Use 'ralph docker start $1' instead, or add --host if you accept that."; exit 1; }
    "$ENGINE/setup.sh"; sd=$(state_dir)
    if [[ -f "$sd/orchestrator.pid" ]] && kill -0 "$(cat "$sd/orchestrator.pid")" 2>/dev/null; then echo "already running"; exit 1; fi
    setsid nohup "$ENGINE/orchestrator.sh" >/dev/null 2>&1 &
    echo "started (log: ralph log $1 -f)" ;;
  stop)
    project "${1:-}"; sd=$(state_dir); pid=$(cat "$sd/orchestrator.pid" 2>/dev/null || true)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      pkill -TERM -P "$pid" 2>/dev/null || true   # workers (and their claude sessions) first
      kill -TERM "$pid" 2>/dev/null || true
      pkill -f "$(source "$ENGINE/lib.sh" && echo "$RUNS_DIR")/worktrees.*claude" 2>/dev/null || true
      echo "stopped"
    else echo "not running (on host). In Docker use: ralph docker stop $1"; fi ;;
  status) if [[ -n "${1:-}" ]]; then project "$1"; "$ENGINE/status.sh"; else
            for p in "$HOME_DIR"/projects/*/; do RALPH_PROJECT=$(basename "$p") "$ENGINE/status.sh" | head -n 6; echo; done; fi ;;
  log) project "${1:-}"; sd=$(state_dir); if [[ "${2:-}" == "-f" ]]; then exec tail -n 30 -F "$sd/ralph.log"; else tail -n 60 "$sd/ralph.log"; fi ;;
  report) project "${1:-}"; "$ENGINE/report.sh" ;;
  dryrun) "$ENGINE/dryrun.sh" "$@" ;;
  docker) exec "$HOME_DIR/docker/run.sh" "$@" ;;
  *) usage; exit 1 ;;
esac
