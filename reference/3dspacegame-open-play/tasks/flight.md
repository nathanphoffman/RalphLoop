# flight tasks (round 2)

Owns `src/open_play/flight/`. Milestones d, e, f and g. Reuse `shared/weapons`, `shared/player`, `defense/` and
`flagship/` code; do not change their behaviour. One item per Claude session. Files under about 150 lines. Add tests.
Keep functions pure and testable; live wiring into a flight mode comes later, once the host exists.

- [ ] Big ship hull models: distinct flat-shaded Frigate and Dreadnought models in `flight/ships/hull_models/`, through the existing `draw_hull`. Tests: vertices are finite, the Dreadnought is bigger than the Frigate.
- [ ] Big ship cockpit frames: Frigate and Dreadnought overlays in `flight/ships/cockpit_frames/` through the existing `draw_cockpit`. Tests as for the other frames.
- [ ] Mining beam: `flight/mining/beam.rs` with a `MiningBeam` state (range, aim, damage rate per second, energy use) and a function that drains a `Deposit` and returns tons mined. Tests: drain over time, out of range mines nothing, stops when the hold is full.
- [ ] Deposits and minerals: `flight/mining/deposits.rs` with `Deposit`, a mapping from `BodyType` to which goods it yields (ice gives ice and volatiles, rocky gives metals), and a seeded placement function for asteroid fields and mines. Tests: deterministic, every mineable body type yields something.
- [ ] Scan action: `flight/scanning/` with a hold-to-scan state (`ScanProgress`: target body, seconds held, needed seconds that grow with body size, range and aim cone, cancel on look away). Tests for complete, cancel and out of range. It only reports "scan finished for body X"; payout is the host's job.
- [ ] Death and crates: `flight/loot/death.rs` with `drop_crate_on_death(profile, position, now)` using `Cargo::split_half_for_death`, `insurance_fee(ship_value)`, `respawn_class(money)` (pays the fee or falls back to the Starter), and a `nearest_crate_in_reach` pickup helper. Tests: half cargo dropped, a single unique is lost, no money gives the Starter.
- [ ] Bounties and PvP rules: `flight/combat/rules.rs` with `can_damage(attacker, victim, system_is_safe)` (no PvP in Sol, enemies always) and `bounty_for(enemy_kind)` table with named constants (fighter, cruiser, pirate, player scaled by ship value). Tests for Sol and non-Sol.
- [ ] Encounter plan: `flight/waves/plan.rs` with a pure `encounters_for(system_danger, seed, clock)` returning scheduled waves and one-off patrols/pirates (counts and enemy kinds rise with danger; Sol has a few weak ones). Tests: deterministic, higher danger means more or tougher enemies, Sol is non-empty but small.
