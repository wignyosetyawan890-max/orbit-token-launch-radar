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
