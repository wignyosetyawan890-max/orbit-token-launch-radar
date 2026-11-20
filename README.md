# ORBIT — Token Launch Intelligence Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/wignyosetyawan890-max/orbit-token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/wignyosetyawan890-max/orbit-token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

ORBIT is an offline research entry for make.fun `token-radar-01`. It consumes the competition's frozen DefiLlama snapshot, builds a ranked pre-token research board, separates already-live token protocols, exposes the full snapshot explorer, and creates a dashboard plus a make.fun dossier.

**Important scope:** the source snapshot contains protocol name, slug, category, chains, TVL, seven-day TVL change, market cap, tracked-since date, CoinGecko ID and symbol. It does not contain official project URLs, contract addresses, live campaign status, points terms, eligibility, minimum deposits, lockups, reward formulas, gas quotes or transaction costs. Therefore every campaign is labelled `UNVERIFIED`. The seven per-protocol steps are a category-specific research plan, not a deposit/bridge/staking strategy. No transaction, wallet connection or signature should be recommended from this snapshot alone.

## Model and validation

The production valuation is a fitted TVL-only comparable model:

```text
log10(implied market cap) = 3.9076763567 + 0.4048681581 × log10(TVL USD)
```

The fit uses 94 deduplicated, category-transferable traded-token comparables. The model-selection experiment on 128 unique valid comparables used four repeats of five grouped folds (grouped by CoinGecko ID), producing **512 held-out token predictions per candidate**. Reported log-MAE values from that 128-token comparison are:

| Candidate | Out-of-sample log-MAE |
|---|---:|
| M0 robust median mcap/TVL baseline | 0.7756 |
| M1 category-shrunk multiple | 0.7983 |
| M2 full log-mcap regression (TVL + growth + age) | 0.7259 |
| M3 weighted k-nearest neighbours (k=8) | 0.7662 |
| M4 validation-weighted ensemble | 0.7209 |
| M2 TVL-only (selected) | **0.6877** |

A separate repeated evaluation on the 94-token transferable subset recorded TVL-only log-MAE 0.6634 versus 0.7571 for its subset baseline. The final coefficients are refit on those 94 comparables. The residual calibration MAE of 0.6592 comes from 376 repeated out-of-fold residual predictions on that 94-token subset. **Do not compare the 0.6592 calibration statistic directly with the 0.6877 128-token model-selection score:** they are different samples and evaluation stages.

The residual 10th/90th percentile multipliers produce a broad aggregate range of approximately x0.06 to x9.77 around the point estimate. This is a historical empirical residual range, not a guaranteed future coverage rate. It deliberately communicates substantial model uncertainty.

The shipped model is TVL-only because growth and age did not improve the chosen out-of-sample comparison. Since the fitted TVL coefficient is positive and no other predictor enters the production score, **the board ordering is mathematically equivalent to sorting by TVL**. The fitted model adds an implied market-cap estimate and historical uncertainty range; it does not create independent evidence of token-launch likelihood, rewards, timing or investment return.

The dashboard also shows nearest same-category comparables as descriptive references. That lookup is distinct from M3, which was separately evaluated as a predictive kNN candidate.

## Board scope

The full explorer contains every protocol in the frozen snapshot. The ranked board is narrower: it includes the supplied watchlist (which is authoritative because `parentProtocol` is absent from the frozen schema) plus eligible pre-token protocols below the floor. The snapshot's watchlist must be covered exactly. The board row count must not be described as the full explorer count; these are separate populations.

## Campaign verification workflow

For each ranked row, ORBIT exposes seven steps. Steps 1-2 verify identity and deployments from snapshot facts (name, category, chains, TVL, 7-day change, tracked age). Steps 3-4 are the category's own product actions — for example, a Dex row checks swaps and liquidity provision, a Lending row checks supply/borrow markets and health factors, a Risk Curators row checks curator vaults and risk limits — drawn only from what the DefiLlama category means, never from an invented campaign, contract or amount. Step 5 checks campaign status (always `UNVERIFIED` here). Step 6 builds a cost/risk sheet from a live gas quote, with the category's main risks named. Step 7 is the decision gate:

1. Verify the project identity and official domain from independent primary sources.
2. Verify chain deployments, contract addresses, version and security evidence.
3. Carry out the category's first product action on the verified official interface, and record what it actually offers.
4. Carry out the category's second product action, and record exact options, limits and terms.
5. Check official documentation and verified announcement channels for a live campaign; status stays `UNVERIFIED` without primary-source evidence.
6. Calculate transaction-level gas, approval, bridge/swap, exit and capital-lockup costs using current evidence; no cost is estimable from the snapshot alone.
7. Escalate to the user for explicit approval; absent complete primary-source evidence, record no action.

A step that would need a chain list longer than the 600-character gate names the first five chains and counts the rest (this mattered for vfat.io with 39 chains and steer-protocol with 45). No per-protocol official documentation was verified for all 178 rows: the snapshot carries no official URLs, so each step requires the reader to verify the primary source before any action, and no campaign, reward, deposit minimum, contract address, gas figure or time estimate beyond review effort is asserted.

Research priority (`review`, `watch`, `low`) is a screening heuristic derived from the valuation proxy and tracked age. It is not an airdrop likelihood score, campaign state, eligibility judgment, or recommendation to transact. Cost and capital fields intentionally remain `null` because the frozen snapshot cannot support those estimates.

## Run it

Node 22.18+ is required by the competition environment. The entry is designed for offline execution and uses the competition's vendored dossier library.

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

In the grader, the program reads `/input/snapshot.json` and writes to `/output`. Locally, `MAKEFUN_OUTPUT_DIR` and `--input` allow an equivalent dry run. The program checks snapshot shape, board coverage, continuous ranks, descending implied value, interval consistency, research-step limits and evidence-state invariants before writing outputs.

## Repository layout

- `main.ts` — deterministic entrypoint and output/dossier generation.
- `lib/model.ts` — snapshot validation, model, comparable selection, board construction and gate checks.
- `vendor/makefun-board.ts` — vendored make.fun dossier library; preserve byte-for-byte.
- `dashboard/` — static offline UI, generated data is supplied by `data.js`.
- `screenshots/` — competition screenshots; preserve the three required board/detail/filtered captures. Each shot is kept as base64 text (`1-board.png.b64`) because the GitHub snapshot push accepts UTF-8 files only and cannot carry a binary PNG; `main.ts` decodes each `.b64` back to the exact PNG bytes at run time, so the output always holds real PNGs. A real PNG sitting next to its `.b64` is used as-is.
- `tests/` — local regression tests for data validation, deterministic output, board invariants and research-only farm/evidence semantics.

## Submission readiness

This source revision is **not a submission**. Before submission, Muse must apply and record the revision in its own authenticated make.fun work session, preserve the original owner claim and screenshots, run the actual `makefun check` and the official offline sandbox/second-run determinism checks, regenerate the dossier, and produce a fresh transcript bundle containing all required parent/child session IDs and tool provenance. Do not sign or submit until those checks are independently confirmed.

---

<sub>Entered on [make.fun](https://make.fun/?ref=n4ftnft9&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
