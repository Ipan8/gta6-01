# SOLMARA HEAT

[![GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Ipan8/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Ipan8/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in **Solmara Bay** — a sun-soaked coastal city.
You are Rico "Reef" Marlowe, a wheelman fresh out of a 3-year stretch,
taking jobs for Mama Sol's crew while Bay PD breathes down your neck.
Built for the [GTA 6 $1,666 bounty on make.fun](https://make.fun/bounty/gta6-01).
Original IP: no Rockstar content, no borrowed assets.

## Play

Open `game/index.html` in a desktop browser, or serve it locally:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network: the game is plain static files, Three.js r160
vendored under `game/vendor/`.

## Controls

- **WASD** — move on foot / drive
- **Mouse drag** — look around (orbit camera)
- **E** — enter or exit a car (steal one: the cops notice)
- **Click** — shoot the pistol
- **R** — reload · **F** — interact (grab cash, start a time trial)
- **Shift** — sprint · **Space** — jump · **P** — pause

## What is in the city

- **A procedural open world**: 12×12 blocks of streets, stucco towers,
  palms, a beach south and a harbour east — the same seed always builds the
  same city.
- **Driving**: 4 car classes (sedan, cab, pickup, sports) with arcade
  handling, traffic that obeys lights, and pedestrians who flee gunfire.
- **Wanted system**: crimes raise heat (0–5 stars). Cruisers pursue and ram,
  roadblocks appear at 3 stars, the police helicopter circles at 5. Lose the
  cops to cool off — or get busted and lose $150.
- **5-mission chain** for Mama Sol's crew: get back on the street, a getaway,
  a repo job (steal the Vortex GT), a harbour heist against a rival crew,
  and a 5-star survival run to the marina. Finish all five to beat the game.
- **Side work**: taxi fares (pick up a ped, deliver them) and time-trial
  races (4 gates, 90 seconds).
- **Combat**: pistol with magazine + reserve, a tracer and hit feedback,
  rival crew who chase and shoot back.
- **HUD + minimap**: health, cash, wanted stars, clock, ammo, speed,
  objective line, and a live minimap with police and mission markers.
- **Save**: cash and mission progress persist in localStorage.
- **Sound**: fully synthesized WebAudio — engine, sirens, gunshots, ambience.

## Files

- `game/` — the game (index.html + ES modules under `src/`, Three.js under `vendor/`)
- `screenshots/` — the 4 entry screenshots (cover first)
- `main.ts` — builds `/output/dossier.json` (Node 22, standard library only)
- `serve.ts` — a tiny static server for local play
- `shots.json` — the 4 deterministic screenshot scenes (`?shot=cover|drive|mission|start&seed=7`)

## License

MIT — see [LICENSE](LICENSE).
