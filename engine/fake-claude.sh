#!/usr/bin/env bash
# Stand-in for `claude -p` used by dryrun.sh. It does what each Ralph prompt asks, in the simplest possible way.
# Called as: fake-claude.sh -p "<prompt>" --dangerously-skip-permissions
# Reads the first line of the prompt: [ralph:<kind> key=value ...]
prompt=$2
header=$(head -1 <<<"$prompt")
kind=$(grep -o '^\[ralph:[a-z0-9]*' <<<"$header" | cut -d: -f2)
field() { grep -o "$1=[^] ]*" <<<"$header" | head -1 | cut -d= -f2; }
round=$(field round)
loop=${LOOP_DIR:-ralph}
export GIT_AUTHOR_NAME=fake GIT_AUTHOR_EMAIL=fake@example.com GIT_COMMITTER_NAME=fake GIT_COMMITTER_EMAIL=fake@example.com

case "$kind" in
  worker)
    area=$(field area)
    sed -i '0,/^- \[ \]/s//- [x]/' "$loop/tasks/$area.md"
    mkdir -p "src/$area" && echo "$area" > "src/$area/dry-$(date +%s%N).txt"
    git add -A && git commit -q -m "fake($area): did one item"
    ;;
  quality) : ;;
  round0)
    mkdir -p src && echo "// fake skeleton" > src/skeleton.txt
    git add -A && git commit -q -m "fake: round 0 skeleton"
    ;;
  merge)
    for branch in $(field branches | tr , ' '); do
      git merge --no-ff --no-edit -q "$branch" || git merge --abort
    done
    ;;
  plan)
    echo "fake progress for round $round" >> "$loop/PROGRESS.md"
    if (( round >= ${FAKE_COMPLETE_AT_ROUND:-1} )); then
      touch "$STATE_DIR/COMPLETE"
    else
      for area in $(field areas | tr , ' '); do echo "- [ ] fake next-round item for $area" > "$loop/tasks/$area.md"; done
    fi
    git add -A && git commit -q -m "fake: plan round $round"
    ;;
  fixbuild) : ;;
  *) echo "fake-claude: unknown prompt kind '$kind'" >&2; exit 1 ;;
esac
