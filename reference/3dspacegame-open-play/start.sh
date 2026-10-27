#!/usr/bin/env bash
# start.sh: one-time setup before the first run. Commits ralph/ to main and puts the three worktrees on main.
# It refuses to touch a worktree that has work not on main.
set -eu
source "$(dirname "$0")/config.sh"
cd "$MAIN_DIR"

[[ "$(git branch --show-current)" == main ]] || { echo "main repo is not on branch main"; exit 1; }
other=$(git status --porcelain | grep -vE ' (ralph/|justfile)' || true)
[[ -z "$other" ]] || { echo "main has other uncommitted changes, commit them first:"; echo "$other"; exit 1; }

git add ralph justfile
git diff --cached --quiet || git commit -q -m "Add the Ralph loop for Open Play (spec, contracts, tasks, scripts)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"

for area in "${AREAS[@]}"; do
  dir=$(wt_dir "$area")
  [[ -z "$(git -C "$dir" status --porcelain)" ]] || { echo "$dir has uncommitted changes"; exit 1; }
  git -C "$dir" merge-base --is-ancestor HEAD main || { echo "$dir has commits that are not on main"; exit 1; }
  git -C "$dir" reset -q --hard main
  echo "$area: $dir on $(wt_branch "$area") at $(git -C "$dir" rev-parse --short HEAD)"
done
mkdir -p "$STATE_DIR/logs"
echo "Ready. Run: nohup ralph/orchestrator.sh > /dev/null 2>&1 &   (log: $STATE_DIR/ralph.log)"
