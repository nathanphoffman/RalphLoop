# Decisions

Calls the loop made without asking. Newest at the bottom. Format: `- [round, area] decision: why`.
Anyone may override one by editing it here and saying so in PROGRESS.md.

## Set up before round 0 (by the architecture session)
- [setup] Three areas named `world`, `flight`, `interface`, mapped to the existing worktrees: worktree-1/work-1, worktree-2/work-2, worktree-3/work-3. Why: they exist, are clean and had no commits ahead of main.
- [setup] Worktrees are reset to main before round 0. Why: they only lagged main, with nothing unique on them.
- [setup] Open Play code lives in `src/open_play/<area>/`. Why: the repo gives every mode its own folder, and separate folders keep file ownership disjoint.
- [setup] Shared files (menu, GameMode, message enum, mod.rs lists) are "integration points": append-only edits, conflicts resolved by the merge step keeping both sides.
- [setup] Ralph state (done markers, logs, COMPLETE) lives outside the git repos in `../.ralph/`. Why: no git noise, and the markers cannot be committed by mistake.
- [setup] Starter ship, base cockpit and base weapons stay as they are in the base game. Open Play adds to them.
- [setup] Weapon mount levels: Laser/Cannon I, Minigun/Scatter/Plasma II, Rail/Ion/Mega III. Missiles: the cheap ones I, mid ones II, Torpedo III. The mining beam is a level I weapon item. Why: simplest rule that matches "higher numbered weapons use higher mounts".
- [setup] Player identity is the display name plus a random secret token made on first run and kept in the local save. Why: no accounts exist, and it stops name clashes without a login system.
- [setup] Station price model: `price = base_value * station_modifier * exp(PRESSURE_STRENGTH * pressure)`. Buying adds pressure (price up), selling subtracts (price down). Pressure decays toward 0 with a half-life of a few real hours, so prices recover without traders. Buying is unlimited but the exponential makes big buys prohibitive. Why: matches "infinite stock, prohibitive cost, prices stabilise".
- [setup] Scan payout: `scan_value_base * max(MIN_SCAN_FRACTION, min(1, seconds_since_last_scan / FULL_SCAN_RECOVERY_SECONDS))`. Why: more time since last scan pays more; a recent scan still pays a little.
- [setup] Mining beam is a fitted weapon-type item, so any ship with a free level I mount can mine. Prospector has an extra one. Why: keeps the mount rules to one system.
- [setup] Universe timekeeping uses real seconds on the host (saved as `clock`). Why: the user wants prices and scan values to change while nobody is online.
- [setup] Loot crates are kept by the host until picked up, and the save is written every minute and on exit. Why: persistent universe.
- [setup] Danger level of a system is based on distance from Sol; waves only run in some systems. Why: stated by the user.
- [setup] The loop works in rounds; each round each area gets at most 8 small checklist items (one fits in one Claude session). Why: keeps each commit reviewable and the build green.
- [round 0, setup] Added derives (Eq, PartialOrd, Ord, Debug) to `Primary` and `Secondary` in shared/weapons so `ItemId` can be a map key; behaviour-neutral. Why: ammo is a `BTreeMap<ItemId, u32>`.
- [round 0, setup] Contract stubs live one file per concern; `contracts/mod.rs` allows dead_code and unused_imports until the areas use them. `Cargo` holds its own `capacity_tons`; `SeatKind` is Top/Bottom/Rear; `OpenPlayWorld` uses `OpenPlayResult<T>` and a `PriceRow` type; antimatter cost is 10 per light-year as a placeholder. Why: contracts left these open.
- [round 1, world] Edited contracts/universe.rs minimally: `build()` delegates to `world::universe::build_universe()` and `from_parts` was added, since the private fields could not be filled from the world area. Why: the contract had no other way to build the real universe.
[round 1, world] Catalog includes TRAPPIST-1 (~40 ly) beyond the 20 ly range; body display names are hand-written until the name generator item.
- [round 1, world] Quality pass: added doc comments to `unique`, `next_u64`, `scan_value_for` and two tests. Skipped: catalog long `systems` functions (pure data tables), "never read" vars in names.rs (false positives, they are used in `format!`), `add_system` bool flag (would change a shared signature), boolean-style test names, other areas' files.
[round 1, world] Gap filler uses its own seeded `Dice` (SplitMix64) instead of macroquad `rand`, which is global and not reproducible.
- [round 1, world] Quality pass: added "how it works" comments to the clever lines in universe filler/stations/tests.
- [round 1, world] Skipped: catalog `systems()` functions (long data tables, splitting is large), `facts/*` branchy `facts` matches (lookup tables already), `add_system` bool flag and `push_body` cohesion (would reshape the builder API).
- [round 1, world] Quality pass: added "how it works" comments to the SplitMix64 bit tricks, the filler test iterator chain, and doc comments on filler.rs helpers. No behaviour change.
- [round 1, world] Skipped: catalog `systems` fns (long data tables), facts/modifier_table branch counts (lookup tables by nature), `add_system` bool flag and `push_body` cohesion (would change builder API), test names containing "and" (descriptive test names).
- Round 1 merge: applied world's requests. `contracts::quote_warp` and `Goods::all` now call `world::warp::quote_warp` and `world::economy::all_goods` (both widened to `pub(in crate::open_play)`).
- [round 1, flight] Ship stats are multiples of the base ship (speed and defence scale off MAX_SPEED/MAX_SHIELD etc.), turn_rate is a multiplier with Starter 1.0; `ship_spec()` in flight/ships/specs.rs replaces the placeholder `ShipSpec::of`. Why: keeps the Starter identical to the base ship.
- [round 1, flight] Quality pass: added a doc comment to `ship_spec`, shortened three test names that read as doing several things, named the hauler cargo multiple in the ship spec tests.
- [round 1, flight] Skipped: `ship_spec` branch count (one match arm per class is the clearest form); nested-closure note in `loadout.rs` (an ordinary iterator chain); `mounts/tests.rs:44` and `cargo.rs:55` are not worth changing.
- [round 1, flight] Applying a class sets `build.top_speed_scale` and `damage_taken_scale` (1/toughness) and returns the turn rate; no shared player change. Why: Player has no per-ship caps, and shared code is off limits.
- [round 1, flight] Multi-mount firing is a flight-owned `fire_weapon_mounts` with its own muzzle/spacing constants instead of hooking shared `spawn_cannon_shots`. Why: shared code is private to `shared/game` and must stay behaviour-neutral.
- [round 1, flight] Hull models are plain triangle lists (own small shapes.rs) rather than the defense Slab; the Starter has no model since it uses the base ship. Why: defense's shape helpers are tied to its outline slabs.
- [round 1, flight] Quality pass: added a blank line in hull_models/shapes.rs and two "why" comments (loadout.rs, hull_models/mod.rs).
- [round 1, flight] Skipped: unused-import findings (macroquad prelude, false positives); unnamed numbers in ships/specs.rs (slot counts read clearer inline); ship_spec branch count (one match arm per class); long test names (descriptive on purpose).
- [round 1, flight] Quality pass: renamed 4 "and" test names, added comments on two nested closures (loot/model.rs, ships/loadout.rs).
- [round 1, flight] Skipped: ship_spec too many branches (one match arm per class, clear as is); unused-import findings in flight files (false positives, `macroquad::prelude::*` is used); magic numbers in ships/specs.rs mount counts (readable per-class table).
- [round 1, interface] Quality pass: split `draw_star_map` (new `draw_system`) and `handle_mouse` (new `rotate_while_dragging`, `finish_press`); no behaviour change.
- [round 1, interface] Skipped: `star_color` branch count (a plain type-to-colour table), `update_and_draw` names (project-wide screen convention), "unused import" hits (macroquad prelude globs, false positives).
- [round 1, interface] Quality pass: split draw_star_map (new draw_systems) and commented star_color. Skipped: "unused imports" in interface files (glob `macroquad::prelude::*` false positives), test-name "does several things" findings (descriptive names kept), draw_system bool flags (small, private, clearer than a struct).
- [round 1, interface] Quality pass: added purpose comments to the uncommented complex functions in station/ and trade/, and a blank line in trade/draw.rs.
- [round 1, interface] Skipped: draw_star_map split, bool-flag functions (draw_button, button_rect, order), unused-import hits (build has no warnings, likely false positives), panel.rs:93 test variable. Not worth the risk or churn.
- [round 1, plan] Round 2 splits work so nothing waits on another area: world builds price model, saves, host and server option; flight builds pure rules (mining, scan, death, bounties, encounters) and big ship art; interface builds the remaining station tabs and HUDs against contracts already on main. Live wiring into a flight mode is left for round 3, after the host exists. Why: the three areas cannot see each other's unmerged work.
