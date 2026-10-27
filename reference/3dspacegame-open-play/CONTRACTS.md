# Open Play contracts

The shared interfaces the three areas build against. Round 0 turns the types below into compiling stubs in
`src/open_play/contracts/`. After that **nobody edits `contracts/` except by the merge/plan step** (change it by asking:
add a line under "Requests" at the bottom of this file and the orchestrator applies it next round). Areas may only
*add* new items to a contract file via a Request. Never change or remove existing ones in a worker round.

## Ownership (disjoint)
| Area | Worktree / branch | Owns (may edit freely) |
|---|---|---|
| `world` | worktree-1 / work-1 | `src/open_play/world/**`, `src/open_play/host/**`, `src/open_play/save/**`, `src/server/**`, `src/shared/net/open_play/**` |
| `flight` | worktree-2 / work-2 | `src/open_play/flight/**` (ships, mounts, combat, mining, loot, crew, waves) |
| `interface` | worktree-3 / work-3 | `src/open_play/interface/**` (star map, station menus, HUD, menu entry, models for cockpits only if flight asks) |

Each area also owns its own `ralph/tasks/<area>.md`. Nobody else touches it.

**Integration points** (shared files, many want to edit). Append-only, one line or one small `match` arm each, and
mention it in your commit message: `src/open_play/mod.rs`, `src/shared/game/mod.rs` (`GameMode::OpenPlay`),
`src/shared/menu/modes.rs`, `src/lib.rs`, `src/shared/net/messages/**` (message enum), `CLAUDE.md` (layout list),
`README.md`, `ralph/DECISIONS.md`. If a merge conflict happens here, the merge step keeps both sides.
Any other existing file under `src/shared`, `src/mine`, `src/defense`, `src/flagship`: read freely; change only for a
small hook that you cannot avoid, keep it behaviour-neutral for the other modes, and note it in your commit message.

## Types (Rust, `pub(crate)`, `src/open_play/contracts/`)
Ids are plain newtypes (`struct SystemId(pub u16)`) so they can be written to the save and the network.

- `SystemId(u16)`, `BodyId(u32)` (globally unique, stable from the seeded universe), `StationId(u16)`, `GoodId(u8)`,
  `PlayerKey(u64)` (see DECISIONS.md: name plus secret token).
- `BodyKind { Star, Planet, Moon, Asteroid, Comet }` and `BodyType` (many variants per kind, e.g. `RedDwarf`,
  `GasGiant`, `IceMoon`, `IronAsteroid`, `LongPeriodComet`). `BodyKind::of(BodyType)` exists.
- `struct Body { id, system, name: String, catalog_name: Option<String>, kind, body_type, radius_km, mass_kg,
  orbit: Orbit, facts: Vec<&'static str>, scan_value_base: u32 }`
- `struct StarSystem { id, name, catalog_name, position_light_years: Vec3, star_ids, is_safe_zone: bool, danger: u8,
  bodies: Vec<BodyId>, stations: Vec<StationId> }`
- `struct Universe` with `systems()`, `system(SystemId)`, `body(BodyId)`, `station(StationId)`, `distance_light_years(a, b)`,
  `Universe::build()` (deterministic, same everywhere, no I/O). Sol is `SystemId(0)` with `is_safe_zone = true`.
- `struct Station { id, system, name, kind: StationKind, body: Option<BodyId> }`,
  `StationKind { MiningOutpost, Refinery, FarmDome, ResearchLab, TradeHub, MilitaryYard }`
- `struct Good { id, name, base_value: u32, is_mined: bool, is_unique: bool }`; `Goods::all()`; unique relics are never stacked.
- `struct Cargo` (`BTreeMap<GoodId, u32>` plus `Vec<UniqueItem>`), `capacity_tons`, `used_tons`, `add`, `remove`,
  `split_half_for_death() -> (kept, dropped)` (round down per good, uniques: at most half, odd one lost).
- `MountLevel { One, Two, Three }` ordered. `MountKind { Weapon, Missile }`. `struct Mount { kind, level, fitted: Option<ItemId> }`.
- `ItemId` = a shop item: `Weapon(Primary)`, `Missile(Secondary)`, `MiningBeam`. `ItemId::required_level()`.
- `ShipClass { Starter, Interceptor, Hauler, Prospector, Frigate, Dreadnought }`; `ShipSpec` (speed, turn rate, shield max,
  armor max, energy, cargo tons, mounts `Vec<MountSlot>`, crew seats `Vec<SeatKind>`, price, `has_own_cockpit`).
- `struct Loadout { class, mounts: Vec<Mount> }`.
- `struct ShipStatus { shield, armor, energy, ammo: BTreeMap<ItemId, u32>, antimatter: f32 }`.
- `struct PlayerProfile { key, name, money: i64, loadout, cargo, status, location: Location }`;
  `Location::Docked(StationId)` or `Location::InSpace { system, position: Vec3, velocity: Vec3, orientation: Quat }`.
- `struct MarketState` (per station, per good: `pressure: f32`, `last_update_seconds`) and
  `trait PriceBook { fn buy_price(&self, station, good) -> i64; fn sell_price(&self, station, good) -> i64; fn record_sale(..); fn record_purchase(..); fn drift(&mut self, dt_seconds) }`.
- `struct ScanLedger { last_scan_seconds: BTreeMap<BodyId, f64> }`, `fn scan_payout(body: &Body, seconds_since_last: f64) -> i64`.
- `struct LootCrate { id: u32, system, position, dropped_by: String, cargo: Cargo, dropped_at_seconds: f64 }`.
- `struct WarpQuote { from, to, distance_light_years, antimatter_cost: f32 }`; `fn quote_warp(universe, from, to) -> WarpQuote`.
- `trait OpenPlayWorld` (what the interface and flight areas call; the host and the hidden solo host both implement it):
  `profile(&self, PlayerKey)`, `dock(..)`, `undock(..)`, `buy(..)`, `sell(..)`, `refuel(..)`, `buy_item(..)`, `fit_item(..)`,
  `buy_ship(..)`, `warp(..)`, `scan(..)`, `pickup_crate(..)`, `market_prices(StationId)`. Each returns `Result<_, OpenPlayError>`.

## Network messages (added to the message enum, prefix `OpenPlay`)
Client to host: `OpenPlayHello { name, token }`, `OpenPlayDock`, `OpenPlayUndock`, `OpenPlayTrade { good, tons, is_buy }`,
`OpenPlayShop { item_or_ship }`, `OpenPlayFit { mount_index, item }`, `OpenPlayWarp { to }`, `OpenPlayScan { body }`,
`OpenPlayPickup { crate_id }`, `OpenPlayBoard { host_player }`, `OpenPlaySave { profile_text }`.
Host to client: `OpenPlayWelcome { profile_text, universe_seed }`, `OpenPlayPrices { station, rows }`,
`OpenPlayCrates { rows }`, `OpenPlayNotice { text }`, `OpenPlayRejected { reason }`.
Bump `PROTOCOL_VERSION` once per round at most (by the merge step).

## Events (game-side names, shown in HUD/notices)
`SystemEntered`, `Docked`, `Undocked`, `Sold`, `Bought`, `Warped`, `Scanned`, `BountyPaid`, `ShipDestroyed`, `CrateDropped`,
`CratePickedUp`, `PlayerBoarded`, `OutOfAntimatter`.

## Save format (text, `key=value`, one file per player, `open_play_<name>.cfg`, host has `open_play_universe.cfg`)
`version=1`, `name`, `token`, `money`, `class`, `mounts=I:laser,II:none,...`, `cargo=iron_ore:12;water_ice:4`,
`system`, `station` (or `x,y,z`), `shield`, `armor`, `energy`, `antimatter`, `ammo=cannon:300`.
Universe file: `market.<station>.<good>=<pressure>`, `scan.<body>=<seconds>`, `crate.<id>=...`, `clock=<seconds>`.
Parsers ignore unknown keys and default missing ones, so old files keep loading.

## Requests (areas add lines here, the merge step applies them)
