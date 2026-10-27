#!/usr/bin/env bash
# status.sh: where the loop is. Items per area, round, running or not, rough ETA, last log lines.
set -u
source "$(dirname "$0")/lib.sh"

pid=$(cat "$STATE_DIR/orchestrator.pid" 2>/dev/null || true)
if [[ -f "$STATE_DIR/COMPLETE" ]]; then state="COMPLETE"
elif [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then state="running (pid $pid)"
else state="stopped"; fi

echo "project: $RALPH_PROJECT   state: $state   round: $(cat "$STATE_DIR/round" 2>/dev/null || echo 0)"
printf '%-14s %6s %6s %8s %10s %8s\n' area done open blocked avg-min eta-min
max_eta=0
for area in "${AREAS[@]}"; do
  dir=$(wt_dir "$area"); f=$(tasks_file "$dir" "$area"); [[ -f "$f" ]] || f=$(tasks_file "$REPO" "$area")
  open=$(count_open "$f"); done_n=$(count_done "$f"); blocked=$(count_blocked "$f")
  avg=$(awk -F'\t' -v a="$area" '$3==a && $4=="done" {s+=$5; n++} END {if (n) printf "%d", s/n; else print 0}' "$STATE_DIR/items.tsv" 2>/dev/null || echo 0)
  eta=$(( open * avg / 60 ))
  (( eta > max_eta )) && max_eta=$eta
  printf '%-14s %6s %6s %8s %10s %8s\n' "$area" "$done_n" "$open" "$blocked" "$(( avg / 60 ))" "$eta"
done
echo "rough ETA for this round's open items: ~${max_eta} min (areas run in parallel; merge, checks and planning come on top)"
[[ -s "$STATE_DIR/violations.log" ]] && echo "ownership warnings: $(wc -l < "$STATE_DIR/violations.log") (see $STATE_DIR/violations.log)"
echo "--- last log lines"
tail -n 8 "$STATE_DIR/ralph.log" 2>/dev/null || echo "(no log yet)"
