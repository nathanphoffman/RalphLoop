# Open Play: spec

A persistent, shared, Elite-style universe for up to 16 players. Co-op and "wild west" versus. Fixed map built from
real nearby stars. Fly, fight, mine, scan, trade, upgrade, crew big ships together.
Everything here was decided with the user. Anything not stated is the loop's call: log it in `DECISIONS.md`.
The code rules in the repo's `CLAUDE.md` apply to everything (naming, 150-line files, named constants, the 5 checks).

## 1. Hosting and saves
- One dedicated server binary (`space_shooter_server`) can host any mode: quick lobbies (wave defense, dogfight, etc.)
  and the Open Play universe. A new `--open-play` option starts the persistent universe.
- Max 16 players per universe.
- Solo play: the client starts a hidden host on the same machine (loopback), with the player's own save, so solo and
  online feel the same. The player never sees the host.
- The host owns the shared state: prices, scan history, loot crates, enemy encounters, and each player's profile.
- Each player's profile is kept in two places: locally (their own copy) and on the host. **On a join, the host's copy wins.**
  The local copy is for offline/own-host use. No anti-cheat for now (do not build any).
- Open Play saves are separate from `settings.cfg` and `scores.cfg`. Plain text `key=value` files (the project has no
  serde and takes no new dependencies).
- A profile stores: name, money, ship class, ship loadout (mounts and what is on them), cargo, fuel, location (system,
  and position or the station they are docked at), and live ship status (shield, armor, ammo per weapon, energy).
  Logging out in space and logging back in puts you back in that spot with the same status.

## 2. The universe (fixed, small, mostly real)
- About 30 to 50 star systems: Sol first, then the real nearby stars (Alpha Centauri, Barnard's Star, Wolf 359, Sirius,
  Epsilon Eridani, Tau Ceti, Trappist-1 and so on). Use real star types, positions (light-years) and known exoplanets.
- Bodies in a system: stars (several types: red dwarf, yellow, white, blue giant, brown dwarf, neutron star, binary...),
  planets (rocky, ocean, ice giant, gas giant, lava, desert...), moons, asteroids (belts and lone rocks), comets.
  Several visual/gameplay types of each.
- Real known bodies come from a hand-written catalog. Gaps (small moons, asteroids, comets, unknown planets) are
  filled in by a seeded generator so every machine gets the same universe.
- Every body gets an invented, interesting name. If it is a known real body, its real catalog name is kept in its own
  field (for example name "Marrow Reach", catalog name "Proxima Centauri b").
- Every body kind/type has a few real science facts. They show on the HUD when you point the ship at the body
  (targeting panel).
- A star map screen shows the systems in 3D (rotate, zoom), the selected system's bodies, stations, your position,
  and your dropped loot crates.
- **Sol is a safe system**: no player-versus-player damage. Enemies still exist there. Every other system allows PvP.
- Stations: each system has zero or more. Station types (mining outpost, refinery, farm dome, research lab, trade hub,
  military yard...) bias what they pay.

## 3. Travel
- In-system flight is the normal ship flight from the base game.
- Warping between systems burns **antimatter**, a fuel bought at stations. It is deliberately expensive.
  Cost grows with distance in light-years. Out of fuel means you cannot warp.
- Docking: fly to a station and dock. Docked players can trade, repair, refuel, buy ships/weapons, and board friends' ships.

## 4. Economy
- About 16 goods and minerals, plus a few unique one-of-a-kind relics. Each has a universal base value (see Elite):
  e.g. Water Ice (cheap) up to Void Crystal and relics (rare, expensive). The loop invents the list; it lives in
  `world/economy/goods.rs` and must include mined minerals and manufactured trade goods.
- Each station has its own price modifier per good (its type biases it), so the same good is worth different amounts
  in different places.
- Every station sells every good in unlimited amounts. Price rises steeply with recent buying, so it becomes
  prohibitively expensive past a point, not out of stock.
- Supply and demand: players selling a good to a station lowers that station's price for it; players buying raises it.
  The effect must be strong enough to make trade routes worthwhile.
- Prices drift back toward their normal level over time even when nobody trades (as if bots traded). Runs on the host
  while it is up, and catches up on load from the saved time.
- A cargo-hauler ship class exists with much more cargo room (trade is its role).
- Money comes from: selling mined goods, trading, bounties on enemies (paid instantly on kill), scanning bodies,
  bounties on players are allowed (kills outside Sol).

## 5. Scanning
- Aim at a body and hold a scan to scan it. Pays money. Bigger bodies pay more.
- The longer since *anyone* last scanned that body, the more it pays (scale back up over time to full value,
  with a small floor right after a scan). The host stores the last-scan time for every body.

## 6. Ships (6 generic classes, names can change later)
1. **Starter** (base ship): same cockpit and feel as the base game. 1 weapon mount, 1 missile mount.
2. **Interceptor**: light, fast, twitchy. 2 weapon mounts. Small cargo.
3. **Hauler**: slow, big cargo room. 1 weapon mount, 1 missile mount.
4. **Prospector**: tough miner. Extra mount for the mining beam, medium cargo.
5. **Frigate** (large): slow, strong. Own model, own cockpit. Several front mounts the pilot fires, plus crewed turrets.
6. **Dreadnought** (very large): slower and stronger still. Own model, own cockpit, many mounts, big cargo.
- Every class has a different feel (speed, turn rate, shield/armor, energy) and a different look. The starter keeps the
  base game cockpit; ships 2 to 6 each get their own model and cockpit.
- **Mounts**: a ship has weapon mounts and missile mounts. Mounts have a level: I (weakest), II, III. A weapon fits
  a mount of its level or higher. Higher-numbered base-game weapons use higher-level mounts
  (Laser/Cannon I, Minigun/Scatter/Plasma II, Rail/Ion/Mega III; the missiles likewise, torpedo III). The mining beam is a
  level I weapon item.
- Several mounts fire at the same time (pilot's fire button fires all weapon mounts; missiles on their own button).
- Weapons are NOT picked up from the ground in Open Play. They are bought at stations and fitted to mounts.
  (Ammo, shield and armor pickups from the base game still work.)
- Stations also sell ships, repairs, upgrades and antimatter.

## 7. Crewing big ships
- Frigate and Dreadnought are flown by one person. They also have turret seats (top, bottom, rear) like flagship
  defense (`src/flagship/`); reuse its code where possible.
- Friends meet at a station; the docked friend can choose to board a docked big ship as a gunner.
- Empty top, bottom and rear turrets are run by an automated bot gunner. Real players take over when they board.
- The pilot also has front mounts they fire themselves.

## 8. Combat, enemies and bounties
- Reuse wave defense's space combat (enemy fighters, cruisers, asteroids, targeting).
- Two kinds of encounters: scheduled **waves** that attack in some systems, and **one-off** patrols/pirates.
  Sol has some enemies too (but no PvP). Danger rises with distance from Sol.
- Every enemy has a bounty paid in money the instant it dies.
- PvP is allowed outside Sol ("wild west"). Kill credit and bounties work between players too.

## 9. Mining
- Mines are used as in Mine Liberation, but instead of blowing up the mine you fly in and use a mining beam on mineral
  deposits to fill your cargo hold. Asteroid fields can also be mined with the beam.
- Minerals vary by body type (ice bodies give ice and volatiles, rocky ones give metals, and so on).

## 10. Death
- When your ship is destroyed you drop half your cargo (round down per good, so a single unique item is lost) into
  one crate model (a floating cargo box) at the wreck. Other players (or you) can fly to it and pick it up.
- The crate shows on every player's star map (who dropped it, where). Crates persist on the host until picked up.
- Insurance: you pay an insurance fee (a percentage of ship value) to get a ship back at your last docked station.
  If you cannot pay, you get the free Starter ship.

## Milestones (build in this order, several per round)
a. Universe data and star map: catalog, generator, names, science facts, star map UI, Open Play menu entry, HUD facts.
b. Host and saves: `--open-play` server, profiles, local+host copy, hidden solo host, persisted universe state.
c. Docking and trading: stations, goods, price model with supply/demand and drift, trade menu, antimatter, warp.
d. Ships and mounts: six classes, models, cockpits, mounts, loadouts, shipyard and weapon shop.
e. Mining: mining beam, deposits in mines and asteroid fields, cargo.
f. Scanning: scan action, value rules, host last-scan times, payout, HUD.
g. Combat, waves, bounties, PvP rules, Sol safe zone, death, loot crates, insurance.
h. Crewing big ships: boarding, turret seats, bot gunners.
i. Polish and balance: tuning numbers, tests, cleanup, README section.

**Done means:** all milestones above work together, a player can: start Open Play (solo or joined), launch from a station,
mine/scan/fight, sell, buy a better ship and weapons, warp to another system, die and lose half their cargo, and log
out and back in to the same place. `cargo build`, `cargo test` and `cargo clippy` are clean.
