#!/usr/bin/env bash
# worker.sh <area>: works through tasks/<area>.md inside that area's worktree, one item per Claude session.
set -u
source "$(dirname "$0")/lib.sh"

area=${1:?usage: worker.sh <world|flight|interface>}
LOG_TAG="worker:$area"
dir=$(wt_dir "$area")
tasks="$dir/ralph/tasks/$area.md"
round=${RALPH_ROUND:-0}
logfile="$STATE_DIR/logs/round-$round-$area-claude.log"
fails=0
items=0
since_quality=0

[[ -d "$dir" ]] || { log "no worktree at $dir"; exit 1; }
cd "$dir" || exit 1

# Warn (never revert) when an item touched files outside the area's ownership.
check_ownership() { # <from-commit>
  local file
  while read -r file; do
    [[ -z "$file" ]] && continue
    [[ "$file" =~ $(area_files "$area") || "$file" =~ $INTEGRATION_FILES ]] && continue
    log "OWNERSHIP: $file changed outside $area's area"
    echo "round $round $area $file" >> "$STATE_DIR/violations.log"
  done < <(git diff --name-only "$1" HEAD)
}

# Replace the first line equal to <item> with a blocked "- [!]" line (plain string compare, no sed escaping).
mark_blocked() {
  local item=$1 line replaced=0 tmp
  tmp=$(mktemp)
  while IFS= read -r line || [[ -n $line ]]; do
    if (( ! replaced )) && [[ "$line" == "$item" ]]; then
      printf '%s\n' "- [!] (blocked after $MAX_ITEM_FAILS failed tries) ${item#- \[ \] }"
      replaced=1
    else
      printf '%s\n' "$line"
    fi
  done < "$tasks" > "$tmp"
  cat "$tmp" > "$tasks"
  rm -f "$tmp"
}

# Between features: codequality --full, then fix what is easy (prompts/quality.md).
quality_pass() {
  log "quality pass"
  P_AREA=$area P_ROUND=$round
  run_claude "$dir" "$(render_prompt quality)" "$logfile"
  commit_if_dirty "$dir" "ralph($area): checkpoint after quality pass"
  git reset -q --hard HEAD && git clean -qfd
}

while has_open "$tasks" && (( items < MAX_ITEMS_PER_ROUND )); do
  items=$((items + 1))
  item=$(first_open "$tasks")
  start_head=$(git rev-parse HEAD)
  log "item $items: ${item:0:90}"

  P_AREA=$area P_ROUND=$round
  run_claude "$dir" "$(render_prompt worker)" "$logfile"
  commit_if_dirty "$dir" "ralph($area): checkpoint after item"

  if [[ "$(first_open "$tasks")" != "$item" ]]; then
    fails=0
    check_ownership "$start_head"
    since_quality=$((since_quality + 1))
    (( since_quality >= QUALITY_EVERY )) && { quality_pass; since_quality=0; }
    continue
  fi

  # No progress: throw away half-done edits so the next try starts clean.
  fails=$((fails + 1))
  git reset -q --hard HEAD && git clean -qfd
  log "no progress on item (fail $fails of $MAX_ITEM_FAILS)"
  if (( fails >= MAX_ITEM_FAILS )); then
    mark_blocked "$item"
    commit_if_dirty "$dir" "ralph($area): mark item blocked"
    fails=0
  fi
done

(( since_quality > 0 )) && quality_pass # one at the end of the list too
touch "$STATE_DIR/done-$area"
log "done ($items sessions)"
