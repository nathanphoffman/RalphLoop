#!/usr/bin/env bash
# report.sh: writes a markdown report of the run to $STATE_DIR/report.md and prints it.
set -u
source "$(dirname "$0")/lib.sh"
out="$STATE_DIR/report.md"
{
  echo "# Ralph report: $RALPH_PROJECT"
  echo "Generated $(date '+%F %T')"
  echo
  echo '## Status'
  echo '```'; "$ENGINE_DIR/status.sh" 2>&1 | head -n 12; echo '```'
  echo
  echo '## Sessions per round'
  echo '| round | area | done | failed | blocked | minutes |'
  echo '|---|---|---|---|---|---|'
  if [[ -s "$STATE_DIR/items.tsv" ]]; then
    awk -F'\t' '{k=$2"\t"$3; if ($4=="done") d[k]++; else if ($4=="fail") f[k]++; else if ($4=="blocked") b[k]++; m[k]+=$5; seen[k]=1}
      END {for (k in seen) {split(k, p, "\t"); printf "| %s | %s | %d | %d | %d | %d |\n", p[1], p[2], d[k], f[k], b[k], m[k]/60}}' "$STATE_DIR/items.tsv" | sort -t'|' -k2,2n -k3,3
  fi
  echo
  echo '## Blocked items'
  for area in "${AREAS[@]}"; do grep -H '^- \[!\]' "$(tasks_file "$(wt_dir "$area")" "$area")" 2>/dev/null; done | sed 's|^.*/tasks/||' || true
  echo
  echo '## Ownership warnings'
  if [[ -s "$STATE_DIR/violations.log" ]]; then sed 's/^/- /' "$STATE_DIR/violations.log"; else echo "none"; fi
  echo
  echo '## Warnings and problems from the log'
  grep -E 'WARNING|still red|stalled|interrupted|rate limited|no progress' "$STATE_DIR/ralph.log" 2>/dev/null | tail -n 20 | sed 's/^/- /' || true
  echo
  echo '## Latest decisions (last 15)'
  grep '^- ' "$REPO/$LOOP_DIR/DECISIONS.md" 2>/dev/null | tail -n 15 || true
  echo
  echo '## Milestones (from PROGRESS.md)'
  cat "$REPO/$LOOP_DIR/PROGRESS.md" 2>/dev/null | tail -n 30 || echo "none yet"
} > "$out"
cat "$out"
