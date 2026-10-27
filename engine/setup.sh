#!/usr/bin/env bash
# setup.sh: one-time (and safe to repeat) setup before a run. Commits the loop folder to the base branch and
# creates or resets one worktree per area. It refuses to touch a worktree that has work not on the base branch.
set -eu
source "$(dirname "$0")/lib.sh"
cd "$REPO"

[[ "$(git branch --show-current)" == "$BASE_BRANCH" ]] || { echo "$REPO is not on branch $BASE_BRANCH"; exit 1; }
[[ -f "$LOOP_DIR/SPEC.md" ]] || { echo "$REPO/$LOOP_DIR/SPEC.md is missing (ralph init creates it)"; exit 1; }
other=$(git status --porcelain | grep -vE " $LOOP_DIR/" || true)
[[ -z "$other" ]] || { echo "$REPO has other uncommitted changes, commit them first:"; echo "$other"; exit 1; }

git add "$LOOP_DIR"
git diff --cached --quiet || git commit -q -m "Add the Ralph loop files ($LOOP_DIR/)

$COMMIT_TRAILER"

git worktree prune
for area in "${AREAS[@]}"; do
  dir=$(wt_dir "$area"); branch=$(wt_branch "$area")
  if [[ -d "$dir" ]]; then
    [[ -z "$(git -C "$dir" status --porcelain)" ]] || { echo "$dir has uncommitted changes"; exit 1; }
    git -C "$dir" merge-base --is-ancestor HEAD "$BASE_BRANCH" || { echo "$dir has commits that are not on $BASE_BRANCH"; exit 1; }
    git -C "$dir" reset -q --hard "$BASE_BRANCH"
  else
    mkdir -p "$(dirname "$dir")"
    git worktree add -q -B "$branch" "$dir" "$BASE_BRANCH"
  fi
  echo "$area: $dir on $branch at $(git -C "$dir" rev-parse --short HEAD)"
done
echo "Ready. State and logs: $STATE_DIR"
