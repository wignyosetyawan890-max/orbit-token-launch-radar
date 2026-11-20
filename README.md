# orbit-token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/wignyosetyawan890-max/orbit-token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/wignyosetyawan890-max/orbit-token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

ORBIT — Institutional Token Launch Intelligence Radar. Entry for make.fun competition [`token-radar-01`](https://make.fun/bounty/token-radar-01): it ranks the snapshot's 758 protocols by a fitted implied token value, gives every ranked protocol a farm plan with its gas cost split from the capital at risk, and renders a dashboard with the board, a detail view per protocol, the live-token view and the full 758-protocol explorer.

The model is a fitted comparable model, not a house multiple: `log10(mcap) = 3.9077 + 0.4049 x log10(TVL)`, fitted on 94 deduplicated traded comparables (one row per CoinGecko id). It was chosen by repeated grouped cross-validation (group = CoinGecko id, 5-fold x 4, n = 128 tokens) against a robust median-multiple baseline: the TVL-only fit wins out-of-sample (log-MAE 0.6877 vs 0.7756 baseline), while growth and age were tested and dropped — the full regression's fitted growth coefficient is -1.71. Low/base/high come from out-of-fold residuals per TVL band, and the 80% interval (x0.06 to x9.77) is shown honestly: the signal is weak, and an implied value is an estimate, never a price or a promised reward. No campaign is claimed for any protocol: none was verified.

## Run it

Node 22.18+ (the grader runs the program with no network and no installs).

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Reads the sealed snapshot, writes `board.json`, `data.js`, the dashboard, three screenshots and `dossier.json` into `out/`. Deterministic: the same input writes byte-identical outputs. At grading time the program runs with no arguments: it reads `/input/snapshot.json` and writes `/output`.

## Layout

- `main.ts` — entrypoint: reads the snapshot, builds the board, writes the outputs and the dossier.
- `lib/model.ts` — the ORBIT model: comparable dedup, fitted valuation, board selection, farm plans, gate checks.
- `vendor/makefun-board.ts` — make.fun's dossier library (vendored, byte for byte the kit's copy).
- `dashboard/` — the page: `index.html`, `app.css`, `app.js` (no network, no framework).
- `screenshots/` — the three screenshots: the board, a protocol detail view and a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=n4ftnft9&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
