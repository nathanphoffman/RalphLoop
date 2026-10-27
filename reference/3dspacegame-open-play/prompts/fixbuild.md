[ralph:fixbuild round={{ROUND}}]
Never ask questions. The current branch does not pass the checks. Run the CLAUDE.md checks (cargo fmt; python3 scripts/check_spacing.py --fix; cargo build with no warnings; cargo test; cargo clippy with no warnings), fix every failure with the smallest correct change, and commit "Fix build after round {{ROUND}}". Do not delete features to make tests pass.
Last gate output:
{{GATE_OUTPUT}}
