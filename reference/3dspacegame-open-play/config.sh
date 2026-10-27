# Shared settings for the Ralph scripts. Every value can be overridden from the environment (the dry run does).
RALPH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_DIR="${MAIN_DIR:-$(dirname "$RALPH_DIR")}"
STATE_DIR="${STATE_DIR:-$(dirname "$MAIN_DIR")/.ralph}" # markers, logs, COMPLETE: outside the git repos on purpose
INTEGRATION_DIR="${INTEGRATION_DIR:-$(dirname "$MAIN_DIR")/integration}" # where rounds are merged and checked
INTEGRATION_BRANCH=integration
CLAUDE_BIN="${RALPH_CLAUDE:-claude}"

AREAS=(world flight interface)
MERGE_BRANCHES="work-1, work-2, work-3" # merge order

ITEM_TIMEOUT="${ITEM_TIMEOUT:-2700}"      # seconds one Claude session may run
MAX_ITEM_FAILS="${MAX_ITEM_FAILS:-3}"     # tries on one item before it is marked blocked "- [!]"
MAX_ITEMS_PER_ROUND="${MAX_ITEMS_PER_ROUND:-24}" # safety stop for one worker per round
QUALITY_EVERY="${QUALITY_EVERY:-3}"           # finished items between code-quality passes
MAX_ROUNDS="${RALPH_MAX_ROUNDS:-30}"
BACKOFF_START="${BACKOFF_START:-60}"      # seconds, doubles up to BACKOFF_MAX
BACKOFF_MAX="${BACKOFF_MAX:-1800}"
MAX_RATE_RETRIES="${MAX_RATE_RETRIES:-100}"
RATE_LIMIT_PATTERN='rate.?limit|429|overloaded|usage limit|too many requests|try again later|quota|capacity'

# area -> worktree folder and branch (the three existing worktrees)
wt_dir() {
  case "$1" in
    world) echo "${WT_WORLD:-$(dirname "$MAIN_DIR")/worktree-1}" ;;
    flight) echo "${WT_FLIGHT:-$(dirname "$MAIN_DIR")/worktree-2}" ;;
    interface) echo "${WT_INTERFACE:-$(dirname "$MAIN_DIR")/worktree-3}" ;;
  esac
}
wt_branch() {
  case "$1" in world) echo work-1 ;; flight) echo work-2 ;; interface) echo work-3 ;; esac
}

# Files each area may change (regex on repo-relative paths). Integration points are allowed for everyone.
INTEGRATION_FILES='^(src/open_play/mod\.rs|src/open_play/contracts/|src/lib\.rs|src/main\.rs|src/shared/game/mod\.rs|src/shared/menu/modes\.rs|src/shared/net/messages/|CLAUDE\.md|README\.md|Cargo\.(toml|lock)|ralph/(DECISIONS|CONTRACTS)\.md)'
area_files() {
  case "$1" in
    world) echo '^(src/open_play/(world|host|save)/|src/server/|src/bin/|src/shared/net/open_play/|ralph/tasks/world\.md)' ;;
    flight) echo '^(src/open_play/flight/|ralph/tasks/flight\.md)' ;;
    interface) echo '^(src/open_play/interface/|ralph/tasks/interface\.md)' ;;
  esac
}
