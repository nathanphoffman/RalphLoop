[ralph:worker area={{AREA}} round={{ROUND}}]
You are one worker (area {{AREA}}) of an autonomous loop that rewrites the Rust game "{{PROJECT}}" around Deor. Never ask questions.
If something is unclear, make the simplest choice that follows {{LOOP_DIR}}/PLAN.md and add one line to
{{LOOP_DIR}}/DECISIONS.md ("[round {{ROUND}}, {{AREA}}] ...").

GOAL: Deor owns the game's state and logic; Rust is only an engine layer of one-line primitives. At the end at most 10% of
the non-test code is Rust (`python3 scripts/deor_share.py`, goal 90). Adding Deor beside Rust that stays does not count.

Read first, every session: {{RULES_FILE}} (code rules), {{LOOP_DIR}}/SPEC.md (the phase your item is in),
{{LOOP_DIR}}/CONTRACTS.md (the world split, the engine surface, the file layout), {{LOOP_DIR}}/PLAN.md sections 3 and 4
(the architecture and the nine rules) and the section of the phase you are in, {{LOOP_DIR}}/DEOR_BUGS.md,
{{LOOP_DIR}}/tasks/{{AREA}}.md, and the Deor docs when you need them (deor_specification/learn_deor.md, docs/interop.md,
docs/enforced_practices.md, docs/loops.md, docs/move.md, docs/macros.md; the standard library is in lib/).

Do exactly ONE item: the first line in {{LOOP_DIR}}/tasks/{{AREA}}.md that starts with "- [ ]".

THE ARCHITECTURE (PLAN.md section 3; do not drift from it)
- One Deor program: `src/game.deor` imports every `.deor` file that has moved into the rewrite; `scripts/build_deor.sh`
  builds it to `src/game_generated.rs` (included once from `src/lib.rs`) and still builds the not-yet-moved files the old
  per-file way. A file is in exactly one of the two builds. When you move a file into the program, switch every Rust
  caller to `crate::game::` in the same commit and fix its names (rule 5 below).
- Deor owns the state. The world is a few Deor structs (`Ships`, `Combat`, `Field`, `Effects`, `Match`, `Hud`, `Session`,
  `Net`, and the Open Play parts; see CONTRACTS.md). A frame step takes a part by `move` and returns it. Rust holds no
  game state and there is no `GameHandle`: Rust not yet rewritten takes `&mut World` and edits the Deor structs' fields
  directly (they are plain Rust structs with `pub` fields; transitional `impl` blocks in its own folder are fine).
- Rust is the engine only: `src/engine/` holds one-line primitives for drawing, meshes, textures, audio, files, sockets,
  input, time, random and the Vec3/Quat/float helpers, each a `rust` block in an `*_wrappers.deor` or a short tested Rust
  file. A `rust` block has no `if` and makes no decision. Every `raw` type implements `Clone`, `PartialEq` and `Debug`.
- Missing Deor features are handled with Deor patterns, never with Rust logic (PLAN.md 3.4): data enums become a tag enum
  plus a data struct; traits become a tag plus `if` chains; `Option` is a validator type or a `has_x` bool; `Result` is a
  struct with `is_ok` and an error tag; maps are lists with a lookup by id; all maths is `float` (f64) with casts only at
  the engine boundary; byte widths and bit operations go through the `raw Bytes` helpers.

THE NINE RULES (PLAN.md section 4; each one cost real time last loop)
1. Hot loops: inside a loop over entities, pixels or vertices no helper call takes a list or a struct holding a list. Read
   the list in place, pass `move` on the last use, or use a macro. Every loop over more than a thousand items gets a
   timing test with a budget.
2. Hot structs: per-frame entity structs hold only `int`, `float`, `bool`, enums and `raw` Copy types. No strings, no
   nested lists.
3. World: the world and its parts are moved, never passed by clone, and never rebuilt with `with` (it deep-clones the
   source). Take apart with `move (...) in part`, rebuild with `Part next = move (...)`.
4. Big data (meshes, textures, grids above a few thousand cells, the universe catalog): built once from a Deor list by
   the engine, then held as a `raw` handle.
5. Names: one program is one namespace. Shared types are declared once in `src/shared/types/`. Private helpers carry an
   area prefix (`lamp_`, `trade_`). Numbers macros are named for their file. Enum variants carry the enum name
   (`WeaponKindLaser`) or the enum is a typed enum. `scripts/check_deor_names.py` fails the build on a repeat.
6. Engine: a `rust` block is one line, used from at least two places, decides nothing. More than that is a tested Rust
   file in `src/engine/`.
7. Tests stay Rust and are not counted. They build Deor structs directly and call the generated functions. Golden tests
   pin wire bytes and save text once the format has been re-pinned in `f64`.
8. Loops that write back into the list are by index: `for idx in range(len(list))`, `Entity entity = list at idx`, work,
   `list at idx = updated`. `for entity in list` is read-only (writing inside it is a Rust borrow error).
9. One `use` block: `src/engine/prelude_wrappers.deor` holds the program's `use` lines in one top-level `rust` block;
   every other `rust` block writes full paths.

HOW TO DO AN ITEM
0. Scope: only edit files your area owns (pattern: {{OWNS}}). Integration points listed in CONTRACTS.md are append-only
   (`src/game.deor` imports, the prelude `use` block, `src/shared/types/`, the build script). The one exception: when
   your item turns a type that other areas' Rust still uses into a Deor struct (or moves it into the program), you MAY
   make the mechanical edits in their files in the same commit (field renames, `as f32` casts, `crate::game::` paths,
   constructors), change no behavior there, and write "cross-area edit" in the commit message. Anything else another area
   needs goes as one line under "Requests" in {{LOOP_DIR}}/CONTRACTS.md.
1. Measure first: `python3 scripts/deor_share.py` (note hand-written Rust plus `rust`-block lines) and the `#[test]` count
   of the files you will touch.
2. Port from the right source. Rules and data already in Deor on this branch move over nearly unchanged (PLAN.md section
   6 says which must NOT move because `main` removed or replaced them). Everything in Open Play, and every feature in
   PLAN.md section 11, is ported from `main`'s Rust: `git show main:<path>` and `git diff 0a8ecd87 main -- <path>`.
3. Convert whole modules with their callers, then DELETE the Rust they replace in the same commit (functions, structs,
   constants, `use` lines, empty files). Rust that builds a request, calls one Deor function and unpacks the answer is
   Rust growing: move that caller into Deor too.
4. Never drop a test. Port every test to the new code; the `#[test]` count after must be equal or higher (merging two
   tests is allowed only if every assertion survives, said in the note). Pin old behavior with a test before changing
   it; loosen exact float asserts to a tolerance (about 1e-4 relative) and log it in DECISIONS.md.
5. Write legible Deor: short functions, names of 3+ characters, a named variable per intermediate result, numbers in a
   macro, a comment at the top of each file, files under about 150 lines. A function that is only a Rust call is a
   wrapper, not a conversion.
6. Deor bugs: NEVER edit Deor, lib/ or deor_specification/. Read the Rules section of DEOR_BUGS.md first: if the docs say
   it works that way, it is a rule. If Deor generates wrong Rust or rejects something the docs allow, add an entry to
   {{LOOP_DIR}}/DEOR_BUGS.md (what you wrote, what Deor produced, minimal repro, workaround, files), use the simplest
   clean workaround and go on. A transpiler panic that no workaround avoids: mark the item "- [!] needs the user
   (Deor)" and stop.
7. Behavior: no new features, no balance changes beyond what PLAN.md section 11 lists. `todo.md` is not an input.
8. Check: run the quick check until clean, then the tests of the modules you touched (`cargo test <module path>`):
   {{ITEM_CHECK}}
   (The full checks and `codequality --full` run in the quality pass and at merge time.)
9. Update {{LOOP_DIR}}/tasks/{{AREA}}.md: "- [x]" and a short note (Deor lines added, Rust lines removed, net hand-written
   Rust, tests before and after; under 300 characters). Too big for one session: do a coherent part, commit, leave the
   rest as a new "- [ ]" line below, and never leave a file half-converted with more Rust than before. Nothing changed:
   write NO note and stop (a note without code is a failed session).
10. `git add -A` and commit on the current branch with a clear message. Do not push. Do not run git merge/rebase/reset.
One item only, then stop.
