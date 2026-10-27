#!/usr/bin/env bash
# dryrun.sh [sandbox-dir]: runs the whole orchestrator once against a throwaway clone with a fake `claude`
# and no cargo checks. Nothing in the real repo or worktrees is touched.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
real_main="$(dirname "$here")"
sandbox=${1:-$(mktemp -d)}
rm -rf "$sandbox" && mkdir -p "$sandbox"
export GIT_AUTHOR_NAME=dry GIT_AUTHOR_EMAIL=dry@example.com GIT_COMMITTER_NAME=dry GIT_COMMITTER_EMAIL=dry@example.com

git clone -q --no-hardlinks "$real_main" "$sandbox/3dSpaceGame"
cd "$sandbox/3dSpaceGame"
git checkout -q -B main
rm -rf ralph && cp -r "$here" ralph
git add ralph && git commit -q -m "dry run: add ralph"
for n in 1 2 3; do git worktree add -q -b "work-$n" "../worktree-$n" main; done

export MAIN_DIR="$sandbox/3dSpaceGame" STATE_DIR="$sandbox/.ralph" RALPH_CLAUDE="$here/fake-claude.sh"
export RALPH_SKIP_GATE=1 FAKE_COMPLETE_AT_ROUND=1 RALPH_MAX_ROUNDS=3 BACKOFF_START=1 STATE_DIR
"$MAIN_DIR/ralph/orchestrator.sh"

echo "---- checks"
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }
check "COMPLETE exists" "[[ -f $STATE_DIR/COMPLETE ]]"
check "done markers removed" "! ls $STATE_DIR/done-* >/dev/null 2>&1"
check "all 3 branches merged" "[[ \$(git log -8 --oneline | grep -c \"Merge branch 'work-\") == 3 ]]"
check "world items ticked on main" "! grep -q '^- \[ \]' <(git show HEAD:ralph/tasks/world.md) || grep -q 'fake next-round' ralph/tasks/world.md"
check "worktrees sit on main" "[[ \$(git -C ../worktree-1 rev-parse HEAD) == \$(git rev-parse main) && \$(git -C ../worktree-3 rev-parse HEAD) == \$(git rev-parse main) ]]"
check "no ownership violations" "[[ ! -s $STATE_DIR/violations.log ]]"
echo "sandbox: $sandbox  (log: $STATE_DIR/ralph.log)"
exit $fail
