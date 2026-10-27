# interface tasks (round 2)

Owns `src/open_play/interface/`. Milestones a, c and d (screens). Build against the contracts (`PlayerProfile`,
`PriceRow`, `OpenPlayWorld`, `ship_spec`, `ItemId`, `can_fit`) which are on main; do not wait for the host. Use `shared/ui.rs`
(`Screen`, bars, centred text). One item per Claude session. Files under about 150 lines. Add tests where logic exists.

- [ ] Refuel tab: replace the REFUEL stub in `interface/station/` with antimatter shown as a bar, a price per unit, and buy 1 / buy 10 / fill. Returns a `StationAction::Refuel(amount)`. Tests for the amount maths (clamp to tank size and money).
- [ ] Warp from the star map: with a system selected, a WARP button and Enter key return `StarMapAction::Warp(SystemId)`; show red text and disable it when the antimatter is not enough (use `quote_warp`). Tests for the enabled rule.
- [ ] Shipyard tab: list the six ship classes with price, speed, shield, armor, cargo tons and mount counts from `ship_spec`; show the current ship; buy with Enter, returns `StationAction::BuyShip(class)`. Tests for row building and can-afford.
- [ ] Weapons tab: list shop items (base weapons, missiles, mining beam) with mount level and price, show the ship's mounts and what is fitted, choose a mount then an item (disabled when `can_fit` is false), returns `StationAction::BuyItem` / `FitItem`. Tests for fit rules in the list.
- [ ] Crew tab: list big ships docked here with their free seats (a `Vec<DockedShip>` passed in) and a Board button returning `StationAction::Board(owner)`; empty state text when none. Tests for row building.
- [ ] Flight HUD: `interface/hud/status.rs` drawing money, cargo used/capacity, antimatter, current system and the notice line (`Sold`, `Bought`, `Warped`, `BountyPaid` texts). Tests for text formatting.
- [ ] Scan HUD: `interface/hud/scan.rs` drawing the scan progress ring/bar around the reticle and a "+$N" payout flash, driven by plain inputs (progress 0 to 1, payout). Tests for the fade-out timing.
- [ ] System view: `interface/star_map/system_view.rs`, a top-down view of the selected system's bodies and stations (orbit order, scaled), selectable from the star map; shows crate markers in this system and the player's marker. Tests for the layout maths.
