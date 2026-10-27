[ralph:round0]
You are the setup step of an autonomous build loop. Never ask questions; log assumptions in ralph/DECISIONS.md ("[round 0, setup] ...").
Working directory is the main repo on branch main.

Read CLAUDE.md, ralph/SPEC.md, ralph/CONTRACTS.md.
Create the compiling skeleton so three areas can work in parallel:
- src/open_play/mod.rs with `mod contracts; mod world; mod flight; mod interface;` and, for each area, a `mod.rs` that is a one-line doc comment. Register `mod open_play;` in src/lib.rs (and main.rs if the repo does it there). No GameMode changes yet (the interface area adds `GameMode::OpenPlay`).
- src/open_play/contracts/ : every type, trait and function signature listed in CONTRACTS.md as compiling Rust with doc comments (small files, each under about 150 lines, stubs like `todo!()` are fine for functions but add `#[allow(dead_code)]` only where truly needed). Include `Universe::build()` returning a tiny hard-coded Sol with a few bodies so the interface area can draw something, and a `FakePriceBook` for tests.
- Update the layout list in CLAUDE.md with the `src/open_play/` folders (world, flight, interface, contracts) and their one-line purpose.
Run the CLAUDE.md checks until clean (fmt, spacing --fix, build with no warnings, test, clippy). Commit on main. One commit.
