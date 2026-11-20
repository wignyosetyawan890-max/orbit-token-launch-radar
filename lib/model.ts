// ORBIT — Institutional Token Launch Intelligence Radar (token-radar-01).
//
// The valuation is a fitted comparable model, not a house multiple.
//
// Candidate selection uses repeated grouped cross-validation on the frozen
// snapshot (group = CoinGecko id, 5 folds x 4 repeats, 128 unique tokens).
// Each candidate therefore has 512 held-out token predictions, not 2,560.
// The shipped fit is TVL-only because its 128-token CV score (0.6877) beats
// the baseline (0.7756), full regression (0.7259), weighted kNN (0.7662),
// and validation-weighted ensemble (0.7209). A separate 94-token transferable
// category subset is used for the final coefficient fit and residual bands.
// Its 376 repeated out-of-fold residuals yield calibration MAE 0.6592.
// These evaluation populations are distinct and must never be conflated.
// The output is a valuation proxy, not token-launch probability, reward
// probability, an investment recommendation, or a prediction of market timing.
//
// Census of the snapshot (computed live in buildRadar, not assumed):
// 758 protocols, 158 unique gecko_id, 0 duplicates, 128 valid comparables
// (mcap > 0 with a gecko_id), 94 fitted after the category exclusion.
// The watchlist is the snapshot's own array (40 slugs): re-deriving its
// rule from the ten snapshot fields gives 60, because parentProtocol is
// not one of them, so the array is authoritative and never re-derived.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted model, as the dashboard states it and the validation measured it. */
export interface OrbitModel {
  a: number;
  b: number;
  comparables: number;
  oof_mae: number;
  oof_p10: number;
  oof_p90: number;
  bands: Record<string, { n: number; p10: number; p90: number }>;
}

export const MODEL: OrbitModel = {
  a: 3.907676356741851,
  b: 0.4048681580536768,
  comparables: 94,
  oof_mae: 0.6591712666242061,
  oof_p10: -1.1923017174662345,
  oof_p90: 0.9898857446210938,
  bands: {
    '<10M': { n: 92, p10: -1.5069848588798793, p90: 0.6995267119817123 },
    '10-50M': { n: 152, p10: -1.1249251953646748, p90: 1.0128153527402617 },
    '50-100M': { n: 64, p10: -1.261767364898084, p90: 1.2395373866654982 },
    '100M-1B': { n: 40, p10: -0.32310293937665513, p90: 1.0318185033170169 },
    '>1B': { n: 28, p10: -1.7742303079915205, p90: 0.9039291325148238 },
  },
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'orbit-1';

/** The validation record behind the model choice (measured by the offline CV). */
export const VALIDATION = {
  // 128 unique market-cap comparables, 4 repeats x 5 grouped folds.
  cv_unique_tokens: 128,
  cv_repeats: 4,
  cv_folds: 5,
  cv_predictions_per_candidate: 512,
  baseline_log_mae: 0.7755836508717513,
  category_shrunk_log_mae: 0.7982913883024995,
  full_regression_log_mae: 0.7258869347651508,
  weighted_knn_log_mae: 0.7662164277193769,
  tvl_only_log_mae: 0.6877,
  ensemble_log_mae: 0.7208933499042828,
  // Separate CV on the final 94-token transferable subset.
  reduced_baseline_log_mae: 0.7571,
  reduced_tvl_only_log_mae: 0.6634,
  calibration_oof_predictions: 376,
  growth_coefficient: -1.71,
  interval_80_low: 0.06,
  interval_80_high: 9.77,
};

/** Categories whose token economics do not transfer to the board. */
export const EXCLUDED_CATS = new Set(['Bridge', 'Canonical Bridge', 'CEX', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const EXCH = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** A due-diligence step. Snapshot data alone cannot establish live campaign status or costs. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  low_value_usd: number;
  high_value_usd: number;
  confidence: 'high' | 'medium' | 'low';
  comparable_count: number;
  research_priority: 'review' | 'watch' | 'low';
  research_priority_reason: string;
  campaign_status: 'unverified';
  evidence_status: 'snapshot-only';
  farm_gas_usd: null;
  capital_at_risk_usd: null;
  model: {
    a: number;
    b: number;
    log_tvl: number;
    band: string;
    band_p10: number;
    band_p90: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  low_value_usd: number;
  high_value_usd: number;
  confidence: 'high' | 'medium' | 'low';
  comparable_count: number;
  research_priority: 'review' | 'watch' | 'low';
  research_priority_reason: string;
  campaign_status: 'unverified';
  evidence_status: 'snapshot-only';
  farm_gas_usd: null;
  capital_at_risk_usd: null;
  band: string;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One row of the full 758-protocol explorer. */
export interface ExplorerRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  listed_at: string | null;
  token_status: 'pre-token' | 'live';
}

/** One fitted comparable (a deduplicated traded token the model learned from). */
export interface ComparableRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number | null;
}

/** Everything the dashboard needs: the board, the live set, the explorer, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: OrbitModel;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  explorer_size: number;
  comparable_size: number;
  validation: {
    unique_gecko_id: number;
    duplicated_gecko_id: number;
    valid_comparables: number;
    fitted_comparables: number;
    cv_unique_tokens: number;
    cv_repeats: number;
    cv_folds: number;
    cv_predictions_per_candidate: number;
    baseline_log_mae: number;
    category_shrunk_log_mae: number;
    full_regression_log_mae: number;
    weighted_knn_log_mae: number;
    tvl_only_log_mae: number;
    ensemble_log_mae: number;
    reduced_baseline_log_mae: number;
    reduced_tvl_only_log_mae: number;
    calibration_oof_predictions: number;
    growth_coefficient: number;
    interval_80_low: number;
    interval_80_high: number;
  };
  rows: RadarRow[];
  live: LiveRow[];
  all: ExplorerRow[];
  comps: ComparableRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, its category's
 * token economics transfer, not a versioned pool, not a wrapped/staked
 * product of a token that already trades, not an exchange's own product.
 * The watchlist array itself is authoritative (parentProtocol is not one
 * of the snapshot's ten fields), so this rule only gates the early rows.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (EXCLUDED_CATS.has(p.category ?? '')) return false;
  if (VERSIONED.test(p.name)) return false;
  const words = p.name.toLowerCase().split(/\s+/);
  if (words.includes('wrapped') || words.includes('staked') || words.includes('staking')) return false;
  if (EXCH.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** The TVL band a value falls in, for the out-of-fold residual interval. */
export function bandOf(tvl: number): string {
  if (tvl < 10e6) return '<10M';
  if (tvl < 50e6) return '10-50M';
  if (tvl < 100e6) return '50-100M';
  if (tvl < 1e9) return '100M-1B';
  return '>1B';
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The fitted implied value and its measured low/high interval, from TVL alone. */
export function impliedValue(protocol: SnapshotProtocol, model: OrbitModel = MODEL): { base: number; low: number; high: number; logTvl: number; band: string; bandP10: number; bandP90: number } {
  if (!(protocol.tvl_usd > 0)) return { base: 1, low: 1, high: 1, logTvl: 0, band: bandOf(0), bandP10: 0, bandP90: 0 };
  const logTvl = Math.log10(protocol.tvl_usd);
  const baseLog = model.a + model.b * logTvl;
  const band = bandOf(protocol.tvl_usd);
  const b = model.bands[band]!;
  return {
    base: Math.max(1, Math.round(10 ** baseLog)),
    low: Math.max(1, Math.round(10 ** (baseLog + b.p10))),
    high: Math.max(1, Math.round(10 ** (baseLog + b.p90))),
    logTvl: round4(logTvl),
    band,
    bandP10: b.p10,
    bandP90: b.p90,
  };
}

/**
 * The deduplicated traded tokens the model learned from: one row per
 * CoinGecko id (the largest TVL), market cap above zero, category
 * transferable to the board. Computed live from the snapshot.
 */
export function fittedComparables(snapshot: Snapshot): SnapshotProtocol[] {
  const byGecko = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.gecko_id === null || !(p.tvl_usd > 0)) continue;
    const rows = byGecko.get(p.gecko_id) ?? [];
    rows.push(p);
    byGecko.set(p.gecko_id, rows);
  }
  const best: SnapshotProtocol[] = [];
  for (const rows of byGecko.values()) {
    rows.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    best.push(rows[0]!);
  }
  return best.filter((p) => !EXCLUDED_CATS.has(p.category ?? ''));
}

/** The snapshot's token census, computed live (unique ids, duplicates, valid comparables). */
export function tokenCensus(snapshot: Snapshot): { unique_gecko_id: number; duplicated_gecko_id: number; valid_comparables: number; fitted_comparables: number } {
  const seen = new Set<string>();
  let dup = 0;
  for (const p of snapshot.protocols) {
    if (p.gecko_id === null) continue;
    if (seen.has(p.gecko_id)) dup++;
    else seen.add(p.gecko_id);
  }
  // Valid comparables: one row per CoinGecko id (market cap above zero, TVL above zero).
  const byGecko = new Map<string, boolean>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.gecko_id === null || !(p.tvl_usd > 0)) continue;
    byGecko.set(p.gecko_id, true);
  }
  return {
    unique_gecko_id: seen.size,
    duplicated_gecko_id: dup,
    valid_comparables: byGecko.size,
    fitted_comparables: fittedComparables(snapshot).length,
  };
}

/** Confidence in one row's implied value: the interval's width and how many fitted comparables share its category. */
export function confidenceFor(band: string, sameCategory: number): 'high' | 'medium' | 'low' {
  const b = MODEL.bands[band]!;
  const width = b.p90 - b.p10;
  if (width <= 1.5 && sameCategory >= 3) return 'high';
  if (width <= 2.5) return 'medium';
  return 'low';
}

/**
 * Research priority only. This is a triage heuristic derived from the
 * valuation proxy and tracked age; it is not campaign eligibility or
 * evidence that a token launch/reward exists.
 */
export function researchPriorityFor(implied: number, age: number | null): 'review' | 'watch' | 'low' {
  if (implied >= 25_000_000 && age !== null && age >= 180) return 'review';
  if (implied >= 10_000_000) return 'watch';
  return 'low';
}

/** A step as one string, kept within the make.fun gate's 20..600 character range. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Review official sources before any action.`;
  return s;
}

/**
 * Six-step research-only playbook. The frozen snapshot has no official
 * project URLs, contract addresses, campaign flags, eligibility rules,
 * minimum deposits, lockups, gas quotes or reward terms. It is therefore
 * unsafe and factually unsupported to prescribe deposits, swaps, holding
 * periods, capital amounts or gas budgets. Every row stays unverified
 * until primary-source evidence is collected outside this snapshot.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chainText = p.chains.length ? p.chains.join(', ') : 'chain not specified in snapshot';
  const category = p.category ?? 'category not specified';
  const ageText = age === null ? 'tracking age unavailable' : `${age} days in the source dataset`;
  return [
    {
      text: `Identify the authentic project for ${p.name} (${category}). Snapshot evidence is limited to DefiLlama name, slug, TVL and chain metadata; it contains no official website URL. Resolve the domain from a trusted, independently verified primary source before opening links or connecting a wallet.`,
      cost: 'No on-chain cost; source verification only',
      time: '5–10 minutes',
    },
    {
      text: `Verify deployment details for ${p.name}. The snapshot lists ${chainText} but does not provide contract addresses, deployment versions, admin controls or audit status. Match every address against official documentation and the relevant chain explorer; do not infer contracts from token lists or search ads.`,
      cost: 'Unknown until official contracts and actions are identified; do not transact',
      time: '10–20 minutes',
    },
    {
      text: `Check whether ${p.name} has an active points, rewards, testnet or airdrop campaign. Search only the protocol's verified website, documentation and official announcement channels. No campaign field or campaign evidence is present in this frozen snapshot, so status remains UNVERIFIED—not confirmed active and not confirmed absent.`,
      cost: 'No on-chain cost; evidence review only',
      time: '10–15 minutes',
    },
    {
      text: `If an official campaign exists, extract its published start/end dates, eligible networks, required actions, wallet or region restrictions, anti-Sybil conditions, minimums, exclusions and reward formula. Confirm that the terms are still current and preserve the source URLs and capture time. Do not invent qualifying actions or holding periods.`,
      cost: 'No on-chain cost; campaign terms must be verified first',
      time: '10–20 minutes',
    },
    {
      text: `Build a transaction-level cost and risk sheet only after the exact eligible actions are known. Obtain a current gas quote, approval and execution fees, bridge or swap spread, exit cost, minimum capital, lockup, withdrawal constraints, liquidity and smart-contract risks. TVL is not a deposit recommendation and cannot determine a safe capital amount.`,
      cost: 'Not estimable from this snapshot; no capital or gas budget is provided',
      time: '10–20 minutes',
    },
    {
      text: `Decision gate for ${p.name}: mark READY FOR USER REVIEW only when official campaign terms, contract addresses, costs, risks and eligibility are documented with dated primary-source evidence. Obtain the user's explicit approval before any wallet connection, signature or transaction. If evidence is missing or ambiguous, record NO ACTION and keep campaign status UNVERIFIED.`,
      cost: 'No transaction without evidence and explicit user approval',
      time: '5 minutes to document decision',
    },
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: OrbitModel = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor that pass the visible rule, by TVL.
  // Never a replacement for a watchlist row: a chosen protocol stays chosen. A pre-token protocol
  // above the floor that the watchlist does not name is left out (the snapshot carries no
  // parentProtocol field, so the list is authoritative and is not re-derived).
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const comps = fittedComparables(snapshot);
  const sameCat = new Map<string, number>();
  for (const c of comps) sameCat.set(c.category ?? '', (sameCat.get(c.category ?? '') ?? 0) + 1);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, model);
    const age = ageDays(snapshot.as_of, p.listed_at);
    return { p, v, age, conf: confidenceFor(v.band, sameCat.get(p.category ?? '') ?? 0) };
  });
  scored.sort((a, b) => b.v.base - a.v.base || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const priority = researchPriorityFor(s.v.base, s.age);
    const priorityReason = priority === 'review'
      ? 'High valuation proxy and tracked age; verify primary-source campaign evidence before considering activity.'
      : priority === 'watch'
        ? 'Valuation proxy crosses the watch threshold; campaign and contract evidence remain unverified.'
        : 'Below the current research-priority threshold; monitor data and do not infer launch or reward likelihood.';
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.v.base,
      low_value_usd: s.v.low,
      high_value_usd: s.v.high,
      confidence: s.conf,
      comparable_count: sameCat.get(s.p.category ?? '') ?? 0,
      research_priority: priority,
      research_priority_reason: priorityReason,
      campaign_status: 'unverified' as const,
      evidence_status: 'snapshot-only' as const,
      farm_gas_usd: null,
      capital_at_risk_usd: null,
      model: {
        a: model.a,
        b: model.b,
        log_tvl: s.v.logTvl,
        band: s.v.band,
        band_p10: s.v.bandP10,
        band_p90: s.v.bandP90,
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Every protocol in the snapshot, by TVL, for the dashboard's explorer. */
export function explorerRows(snapshot: Snapshot): ExplorerRow[] {
  return [...snapshot.protocols]
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      token_status: isPreToken(p) ? ('pre-token' as const) : ('live' as const),
    }));
}

/** The fitted comparables, by market cap, for the detail view's comparison. */
export function comparableRows(snapshot: Snapshot): ComparableRow[] {
  return fittedComparables(snapshot)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    low_value_usd: row.low_value_usd,
    high_value_usd: row.high_value_usd,
    confidence: row.confidence,
    comparable_count: row.comparable_count,
    research_priority: row.research_priority,
    research_priority_reason: row.research_priority_reason,
    campaign_status: row.campaign_status,
    evidence_status: row.evidence_status,
    farm_gas_usd: null,
    capital_at_risk_usd: null,
    band: row.model.band,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: OrbitModel = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const all = explorerRows(snapshot);
  const comps = comparableRows(snapshot);
  const census = tokenCensus(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    explorer_size: all.length,
    comparable_size: comps.length,
    validation: {
      unique_gecko_id: census.unique_gecko_id,
      duplicated_gecko_id: census.duplicated_gecko_id,
      valid_comparables: census.valid_comparables,
      fitted_comparables: census.fitted_comparables,
      cv_unique_tokens: VALIDATION.cv_unique_tokens,
      cv_repeats: VALIDATION.cv_repeats,
      cv_folds: VALIDATION.cv_folds,
      cv_predictions_per_candidate: VALIDATION.cv_predictions_per_candidate,
      baseline_log_mae: VALIDATION.baseline_log_mae,
      category_shrunk_log_mae: VALIDATION.category_shrunk_log_mae,
      full_regression_log_mae: VALIDATION.full_regression_log_mae,
      weighted_knn_log_mae: VALIDATION.weighted_knn_log_mae,
      tvl_only_log_mae: VALIDATION.tvl_only_log_mae,
      ensemble_log_mae: VALIDATION.ensemble_log_mae,
      reduced_baseline_log_mae: VALIDATION.reduced_baseline_log_mae,
      reduced_tvl_only_log_mae: VALIDATION.reduced_tvl_only_log_mae,
      calibration_oof_predictions: VALIDATION.calibration_oof_predictions,
      growth_coefficient: VALIDATION.growth_coefficient,
      interval_80_low: VALIDATION.interval_80_low,
      interval_80_high: VALIDATION.interval_80_high,
    },
    rows: board.map(radarRow),
    live,
    all,
    comps,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of) || new Date(`${o.as_of}T00:00:00Z`).toISOString().slice(0, 10) !== o.as_of) throw new SnapshotError('snapshot.json has no valid UTC as_of date');
  if (typeof o.source !== 'string' || o.source.trim().length < 10) throw new SnapshotError('snapshot.json has no usable source description');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols) || o.protocols.length === 0) throw new SnapshotError('snapshot.json has no non-empty protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.length === 0 || o.watchlist.some((s) => typeof s !== 'string' || s.trim().length === 0)) throw new SnapshotError('snapshot.json has no usable watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || p.slug.trim().length === 0 || typeof p.name !== 'string' || p.name.trim().length === 0 || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd) || p.tvl_usd < 0) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a valid slug, name or non-negative TVL`);
    }
    // Market cap must be a finite number or absent. A non-positive value is NOT a parse error:
    // the sealed snapshot carries DefiLlama's sentinel mcap_usd = -1 for one protocol
    // (autofinance, whose token is dead) and 0 for fifteen dead-token rows. Those rows are
    // excluded downstream (fittedComparables/tokenCensus require mcap > 0), never valued.
    if (p.mcap_usd !== null && p.mcap_usd !== undefined && (typeof p.mcap_usd !== 'number' || !Number.isFinite(p.mcap_usd))) throw new SnapshotError(`snapshot.json's protocol ${i} has an invalid market cap`);
    if (p.change_7d !== null && p.change_7d !== undefined && (typeof p.change_7d !== 'number' || !Number.isFinite(p.change_7d))) throw new SnapshotError(`snapshot.json's protocol ${i} has an invalid 7-day change`);
    if (p.chains !== undefined && (!Array.isArray(p.chains) || p.chains.some((c) => typeof c !== 'string'))) throw new SnapshotError(`snapshot.json's protocol ${i} has invalid chains`);
    if (p.listed_at !== null && p.listed_at !== undefined && (typeof p.listed_at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.listed_at) || new Date(`${p.listed_at}T00:00:00Z`).toISOString().slice(0, 10) !== p.listed_at)) throw new SnapshotError(`snapshot.json's protocol ${i} has an invalid listed_at date`);
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  const slugSet = new Set<string>();
  for (const protocol of protocols) {
    if (slugSet.has(protocol.slug)) throw new SnapshotError(`snapshot.json has duplicate protocol slug ${protocol.slug}`);
    slugSet.add(protocol.slug);
  }
  const watchlist = o.watchlist as string[];
  if (new Set(watchlist).size !== watchlist.length) throw new SnapshotError('snapshot.json has duplicate watchlist slugs');
  const missingWatchlist = watchlist.filter((slug) => !slugSet.has(slug));
  if (missingWatchlist.length) throw new SnapshotError(`snapshot.json watchlist references missing slug ${missingWatchlist[0]}`);
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist,
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, intervals, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.low_value_usd > r.implied_value_usd || r.high_value_usd < r.implied_value_usd) return `${r.slug} has an interval that does not hold its base value`;
    if (r.campaign_status !== 'unverified' || r.evidence_status !== 'snapshot-only') return `${r.slug} overstates campaign evidence`;
    if (r.farm_gas_usd !== null || r.capital_at_risk_usd !== null) return `${r.slug} contains unsupported cost estimates`;
    if (!['review', 'watch', 'low'].includes(r.research_priority)) return `${r.slug} has an invalid research priority`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
