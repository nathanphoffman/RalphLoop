#!/usr/bin/env bash
# Stand-in for `claude -p` used by dryrun.sh. It does what each Ralph prompt asks, in the simplest possible way.
# Called as: fake-claude.sh -p "<prompt>" --dangerously-skip-permissions
prompt=$2
kind=$(grep -o '^\[ralph:[a-z0-9]*' <<<"$prompt" | head -1 | cut -d: -f2)
round=$(grep -o 'round=[0-9]*' <<<"$prompt" | head -1 | cut -d= -f2)
export GIT_AUTHOR_NAME=fake GIT_AUTHOR_EMAIL=fake@example.com GIT_COMMITTER_NAME=fake GIT_COMMITTER_EMAIL=fake@example.com

case "$kind" in
  worker)
    area=$(grep -o 'area=[a-z]*' <<<"$prompt" | head -1 | cut -d= -f2)
    tasks=ralph/tasks/$area.md
    sed -i '0,/^- \[ \]/s//- [x]/' "$tasks"
    mkdir -p "src/open_play/$area" && echo "$area" > "src/open_play/$area/dry-$(date +%s%N).txt"
    git add -A && git commit -q -m "fake($area): did one item"
    ;;
  quality) : ;;
  round0)
    mkdir -p src/open_play && echo "// fake skeleton" > src/open_play/mod.rs
    git add -A && git commit -q -m "fake: round 0 skeleton"
    ;;
  merge)
    for branch in $(grep -o 'work-[0-9]' <<<"$prompt" | awk '!seen[$0]++'); do
      git merge --no-ff --no-edit -q "$branch" || git merge --abort
    done
    ;;
  plan)
    echo "fake progress for round $round" >> ralph/PROGRESS.md
    if (( round >= ${FAKE_COMPLETE_AT_ROUND:-1} )); then
      touch "$STATE_DIR/COMPLETE"
    else
      for area in world flight interface; do echo "- [ ] fake next-round item for $area" > "ralph/tasks/$area.md"; done
    fi
    git add -A && git commit -q -m "fake: plan round $round"
    ;;
  *) echo "fake-claude: unknown prompt kind '$kind'" >&2; exit 1 ;;
esac
