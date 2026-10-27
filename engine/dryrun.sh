#!/usr/bin/env bash
# dryrun.sh [sandbox-dir]: runs setup + the whole orchestrator against a throwaway toy repo (two areas, alpha and beta)
# with a fake `claude` and no real checks. Proves the loop mechanics work. Touches nothing outside the sandbox dir.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
home="$(dirname "$here")"
sandbox=${1:-$(mktemp -d)}
rm -rf "$sandbox" && mkdir -p "$sandbox"
export GIT_AUTHOR_NAME=dry GIT_AUTHOR_EMAIL=dry@example.com GIT_COMMITTER_NAME=dry GIT_COMMITTER_EMAIL=dry@example.com

repo="$sandbox/repo"
git init -q -b main "$repo"
mkdir -p "$repo/ralph/tasks"
cp "$home"/templates/loop/*.md "$repo/ralph/"
for a in alpha beta; do printf '# %s tasks\n\n- [ ] first %s item\n- [ ] second %s item\n' "$a" "$a" "$a" > "$repo/ralph/tasks/$a.md"; done
echo toy > "$repo/README.md"
git -C "$repo" add -A && git -C "$repo" commit -q -m "toy repo"

mkdir -p "$sandbox/project"
cat > "$sandbox/project/project.conf" <<CONF
REPO="$repo"
AREAS=(alpha beta)
AREA_OWNS[alpha]='^src/alpha/'
AREA_OWNS[beta]='^src/beta/'
CONF

export RALPH_PROJECT=dryrun PROJECT_DIR="$sandbox/project" RALPH_RUNS_DIR="$sandbox/runs"
export RALPH_CLAUDE="$here/fake-claude.sh" RALPH_SKIP_GATE=1 FAKE_COMPLETE_AT_ROUND=2 RALPH_MAX_ROUNDS=4 BACKOFF_START=1
source "$here/lib.sh"

"$here/setup.sh"
"$here/orchestrator.sh"

echo "---- checks"
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }
cd "$repo"
check "COMPLETE exists" "[[ -f $STATE_DIR/COMPLETE ]]"
check "done markers removed" "! ls $STATE_DIR/done-* >/dev/null 2>&1"
check "both branches merged" "[[ \$(git log --oneline | grep -c \"Merge branch 'ralph/\") -ge 2 ]]"
check "work landed on main" "ls src/alpha/dry-*.txt src/beta/dry-*.txt >/dev/null 2>&1"
check "worktrees sit on main" "[[ \$(git -C $(wt_dir alpha) rev-parse HEAD) == \$(git rev-parse main) ]]"
check "items were recorded" "[[ \$(grep -c done $STATE_DIR/items.tsv) -ge 4 ]]"
check "no ownership violations" "[[ ! -s $STATE_DIR/violations.log ]]"
"$here/status.sh" || true
echo "sandbox: $sandbox  (log: $STATE_DIR/ralph.log)"
exit $fail
