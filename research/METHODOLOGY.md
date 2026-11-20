# ORBIT valuation methodology and controls

## Research question

Estimate a snapshot-based implied market-cap proxy for pre-token protocols from observable TVL. This is not a token-launch classifier, reward estimator, trading signal, or investment recommendation.

## Production estimator

`log10(mcap) = 3.907676356741851 + 0.4048681580536768 × log10(TVL_USD)`

The final fit uses 94 unique traded-token comparables after deduplication by CoinGecko ID and exclusion of categories whose token economics were treated as non-transferable: Bridge, Canonical Bridge, CEX, Liquid Staking, Liquid Restaking and Restaked BTC.

## Evaluation populations

**Model selection (128 unique valid comparable tokens):** four repeats of five grouped folds, grouping by CoinGecko ID. Each candidate yields 512 out-of-fold predictions (each unique token is held out once per repeat). Reported log-MAE:

| Candidate | log-MAE |
|---|---:|
| Robust median mcap/TVL baseline | 0.7755837 |
| Category-shrunk multiple | 0.7982914 |
| Full log-mcap regression (TVL + growth + age) | 0.7258869 |
| Weighted kNN (k=8) | 0.7662164 |
| Validation-weighted ensemble | 0.7208933 |
| TVL-only regression | **0.6877** |

**Reduced transferable subset (94 tokens):** TVL-only log-MAE 0.6634; reduced-set baseline 0.7571. The production coefficients are refit on this 94-token set.

**Residual calibration:** 376 repeated out-of-fold residual predictions across the 94-token set; log-MAE 0.6591713. Aggregate p10/p90 residual multipliers are approximately x0.06 and x9.77. These metrics concern different populations and must be labelled separately.

## Interpretation constraints

- The fitted slope is positive. Since TVL is the only production input, ranking by implied value is mathematically identical to ranking by TVL. This is a transformation, not an independent ranking signal.
- The broad residual interval is evidence of substantial uncertainty. It is not a guaranteed future coverage interval.
- M3 kNN was tested as a predictive candidate. The UI's nearest same-category comparable list is a distinct descriptive retrieval tool.
- Age and seven-day change are not used in the production value estimator. Age contributes only to research-priority triage; it must not be interpreted as a campaign signal.
- The snapshot contains no official URL, contract, campaign, points, eligibility, gas, capital, lockup or reward evidence. For this reason every campaign remains `UNVERIFIED`; estimated gas/capital fields are null, and the generated checklist is research-only.

## Farm plan (7 steps per row, audited on all 178 rows)

Each board row carries 7 steps of 20-600 characters. Steps 1-2 verify identity and deployments from snapshot facts (name, category, chains, TVL, 7-day change, tracked age). Steps 3-4 are product actions specific to the row's DefiLlama category (30 distinct categories on the board; the step-3/4 templates differ across all 30, verified by audit). Step 5 checks campaign status, always `UNVERIFIED` in this snapshot. Step 6 builds a cost/risk sheet from a live quote with the category's main risks named; no gas, capital or deposit figure is asserted from the snapshot. Step 7 is the decision gate (NO ACTION without dated primary-source evidence and explicit user approval).

Limits, stated plainly: no per-protocol official documentation was verified for all 178 rows — the snapshot carries no official URLs, so the plan directs the reader to verify the primary source for each protocol and asserts nothing about its campaign, contracts, rewards or costs. Two rows needed a chain-list cap to stay inside the 600-character gate: vfat.io (39 chains) and steer-protocol (45 chains) name their first five chains and count the rest; before that cap, their step 2 was truncated and lost its Cost/Time tail. The regression suite locks this in with a 45-chain fixture test.
