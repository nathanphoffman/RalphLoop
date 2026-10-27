#!/usr/bin/env bash
# run.sh build [rust] | start <project> | stop <project> | shell <project>
# Runs a loop inside the sandbox. Mounts only: the project repo, the Ralph checkout (engine + runs/), any DOCKER_MOUNTS
# from project.conf, ~/.claude (the Claude login) and ~/.gitconfig (read-only). Folders are mounted at the SAME absolute
# path as on the host because git worktrees store absolute paths.
# Deliberately NOT mounted: ~/.ssh and git credential helpers, so nothing in the container can push anywhere.
# The container drops all Linux capabilities, cannot gain privileges, and is limited in CPU, memory and processes.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mode=${1:?usage: run.sh build [rust] | start|stop|shell <project>}; shift

if [[ "$mode" == build ]]; then
  docker build -t ralph-base --build-arg HOST_UID="$(id -u)" --build-arg HOST_GID="$(id -g)" "$here"
  [[ "${1:-}" == rust ]] && docker build -t ralph-rust -f "$here/Dockerfile.rust" "$here"
  exit 0
fi

export RALPH_PROJECT=${1:?project name}
source "$here/../engine/lib.sh"
name="ralph-$RALPH_PROJECT"

if [[ "$mode" == stop ]]; then docker stop "$name"; exit 0; fi

mkdir -p "$RUNS_DIR"
touch "$HOME/.claude.json"
mounts=(-v "$REPO:$REPO" -v "$RALPH_HOME:$RALPH_HOME" -v "$HOME/.claude:/home/ralph/.claude"
        -v "$HOME/.claude.json:/home/ralph/.claude.json" -v "$HOME/.gitconfig:/home/ralph/.gitconfig:ro")
for extra in "${DOCKER_MOUNTS[@]:-}"; do [[ -n "$extra" ]] && mounts+=(-v "$extra:$extra"); done
# Worktrees given explicitly in project.conf live elsewhere; mount their folders too.
for area in "${AREAS[@]}"; do [[ -n "${AREA_WORKTREE[$area]:-}" ]] && mounts+=(-v "$(dirname "${AREA_WORKTREE[$area]}"):$(dirname "${AREA_WORKTREE[$area]}")"); done

flags=(--rm --name "$name" --user "$(id -u):$(id -g)"
       --cpus="${DOCKER_CPUS:-6}" --memory="${DOCKER_MEMORY:-9g}" --pids-limit=4096
       --cap-drop=ALL --security-opt=no-new-privileges
       -e HOME=/home/ralph -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e 'GIT_CONFIG_VALUE_0=*')
[[ -n "${DOCKER_NETWORK:-}" ]] && flags+=(--network "$DOCKER_NETWORK")
image=${DOCKER_IMAGE:-ralph-base}

case "$mode" in
  start) docker run -d "${flags[@]}" "${mounts[@]}" -w "$RALPH_HOME" "$image" "$RALPH_HOME/ralph" run "$RALPH_PROJECT" >/dev/null
         echo "started $name in Docker. Watch: ralph log $RALPH_PROJECT -f   Stop: ralph docker stop $RALPH_PROJECT" ;;
  shell) exec docker run -it "${flags[@]}" "${mounts[@]}" -w "$REPO" "$image" bash ;;
  *) echo "unknown mode $mode"; exit 1 ;;
esac
