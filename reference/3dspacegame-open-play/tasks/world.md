# world tasks (round 2)

Owns `src/open_play/world/`, `host/`, `save/`, `src/server/`, `src/shared/net/open_play/`. Milestones b and c, plus the world side of f.
One item per Claude session. Keep every file under about 150 lines. Add tests with each item. Do not depend on flight or
interface work from this round; read what is already on main (for example `ship_spec`) if you need it.

- [ ] Price model: `world/economy/market.rs` implementing the contracts `PriceBook` with `price = base_value * station_modifier * exp(PRESSURE_STRENGTH * pressure)`, `record_sale`/`record_purchase` moving pressure, and `drift(dt_seconds)` decaying it with a half-life (named constants in `economy/consts.rs`). Tests: buying raises the price, selling lowers it, drift returns toward normal, a big buy is prohibitive, a trade route between two stations is profitable.
- [ ] Item and ship prices: `world/economy/shop.rs` with `item_price(ItemId)`, `ship_price(ShipClass)` (use `ship_spec(class).price` from flight if it exists), `refuel_price(antimatter)` and named constants. Tests: higher mount level costs more, Dreadnought costs the most.
- [ ] Scanning rules: `world/scan/` with `ScanLedger` helpers and `scan_payout(body, seconds_since_last)` per the DECISIONS formula (floor, full value after `FULL_SCAN_RECOVERY_SECONDS`). Tests: a fresh scan pays the floor, an old scan pays full, bigger bodies pay more.
- [ ] Profile save format: `save/profile.rs` writing and reading the `key=value` profile text from CONTRACTS.md (round trip, unknown keys ignored, missing keys default). Tests: round trip for docked and in-space profiles, a damaged file still loads.
- [ ] Universe state save format: `save/universe_state.rs` for `market.*`, `scan.*`, `crate.*` and `clock` lines. Tests: round trip, unknown keys ignored.
- [ ] Host core: `host/` with `OpenPlayHost` holding profiles, market, scan ledger, crates and the clock. Implement `OpenPlayWorld` for `profile`, `dock`, `undock`, `buy`, `sell`, `refuel`, `market_prices`. Tests: buy then sell, not docked, not enough money, cargo full.
- [ ] Host actions: add `warp`, `scan`, `buy_item`, `fit_item`, `buy_ship`, `pickup_crate` to the host (uses the price model, shop prices, scan rules, `can_fit`). Tests for each error case and the happy path.
- [ ] Open Play server option and messages: add `--open-play` to `server/options.rs` (starts a host, loads/saves `open_play_universe.cfg`, saves every minute and on exit, catches up drift on load) and the `OpenPlay*` messages in `shared/net/open_play/` (one-line enum hook in `shared/net/messages`). Tests for option parsing and message round trip.
