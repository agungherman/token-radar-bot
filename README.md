# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Which pre-token protocol is worth farming next — and what to do about it.

Token Radar reads a sealed snapshot of the protocol universe (DefiLlama data, frozen at the bounty snapshot), ranks every protocol that records no token yet by what its launch would be worth, and hands in a static web dashboard with the board, a detail view for every protocol, filters, a model sandbox, and a farm plan for each row.

Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## Run it

```sh
node main.ts --input <snapshot.json>   # writes /output (or MAKEFUN_OUTPUT_DIR=out)
```

Node 22.18 or later, standard library only — no install, no build step. Open `out/dashboard/index.html` in a browser (it reads `out/data.js`, no network).

## How a rank is earned (model radar-2)

```
implied = TVL × 0.22
        × (1 + clamp(change_7d, -50%, +150%) / 100 × 0.6)
        × (0.70 + min(age_days, 1460) / 1460 × 0.30)
        × (1 + min(chains - 1, 4) × 0.03)
        × category factor (1.00–1.10)
```

- **Coverage:** the whole 40-protocol watchlist (TVL ≥ $50M, no token recorded, not a wrapped/staked/bridged product) plus early pre-token protocols below the floor, by TVL — 260 rows in total.
- **Pre-token** means the snapshot records no market cap, no CoinGecko id and no symbol. Wrapped, staked and bridged products, versioned pools, exchange venues and live-token protocols are never ranked.
- **Farm plans:** 7 steps per row, generated from the protocol's own category, chains, TVL tier and age — safety first, a weekly qualifying action, a hold window, and a log.
- **Live view:** protocols that already trade are shown separately at their market cap, never mixed into the ranking.
- **Sandbox:** the dashboard lets you move the base multiple, growth weight and maturity floor and re-ranks the board in the browser. It changes nothing on disk.

Implied value is this radar's own claim, never a market quote. It does not predict whether or when a token is issued.

## Layout

- `main.ts` — entrypoint; reads the snapshot, writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory.
- `lib/model.ts` — the radar-2 model, board builder, farm plans and snapshot parsing.
- `vendor/makefun-board.ts` — make.fun's dossier library, as shipped in the kit.
- `dashboard/` — the static page (`index.html`, `app.css`, `app.js`).
- `screenshots/` — the board, a protocol's detail view, and a filtered view.

## Screenshots

The three screenshots under `screenshots/` are renders of this dashboard: the full board, a detail view, and a category-filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=5wyg9qx0&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
