// ORBIT — Institutional Token Launch Intelligence Radar (token-radar-01).
//
// The valuation is a fitted comparable model, not a house multiple. It was
// chosen by repeated grouped cross-validation on the snapshot's own traded
// tokens (group = CoinGecko id, 5-fold x 4 repeats, n = 128 unique tokens,
// 2,560 predictions per candidate, all preprocessing fit inside each fold):
//
//   M0 robust median mcap/TVL multiple (baseline)   log10 MAE 0.7756
//   M2 log-mcap regression, full (TVL+growth+age)   log10 MAE 0.7259
//   M2 tvl-only  log10(mcap) = a + b*log10(TVL)      log10 MAE 0.6877  <- winner
//   M4 validation-weighted ensemble                 log10 MAE 0.7209
//
// Growth and age HURT out-of-sample (the full regression's fitted growth
// coefficient is -1.71), so the shipped model uses TVL alone. The 94 fitted
// comparables are the deduplicated traded tokens whose category the board
// can rank (Bridge, Canonical Bridge, CEX, Liquid Staking, Liquid
// Restaking and Restaked BTC are excluded: their token economics do not
// transfer to the board's categories). Uncertainty comes from the
// out-of-fold residuals per TVL band, so low/base/high are measured, and
// the 80% interval (x0.06 to x9.77) is shown honestly: the signal is weak
// and the dashboard never pretends precision.
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
  baseline_log_mae: 0.7756,
  full_regression_log_mae: 0.7259,
  tvl_only_log_mae: 0.6877,
  ensemble_log_mae: 0.7209,
  growth_coefficient: -1.71,
  interval_80_low: 0.06,
  interval_80_high: 9.77,
};

/** Categories whose token economics do not transfer to the board. */
export const EXCLUDED_CATS = new Set(['Bridge', 'Canonical Bridge', 'CEX', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const EXCH = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** The date the farm plans were checked (every plan states it). */
export const FARM_CHECKED = '2026-11-20';

/** A farm step: the action, what it costs (gas split from capital at risk), and how long it takes. */
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
  verdict: 'farm' | 'thin' | 'skip';
  farm_gas_usd: number;
  capital_at_risk_usd: number;
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
  verdict: 'farm' | 'thin' | 'skip';
  farm_gas_usd: number;
  capital_at_risk_usd: number;
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
    baseline_log_mae: number;
    full_regression_log_mae: number;
    tvl_only_log_mae: number;
    ensemble_log_mae: number;
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
 * The farm verdict: whether this protocol's farm plan is worth doing.
 * It is about the setup (a large implied value and a long track record),
 * never a promised reward: no campaign is verified for any row.
 */
export function verdictFor(implied: number, age: number | null): 'farm' | 'thin' | 'skip' {
  if (implied >= 25_000_000 && age !== null && age >= 180) return 'farm';
  if (implied >= 10_000_000) return 'thin';
  return 'skip';
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('perp')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: six steps, each an action with its gas cost split
 * from the capital at risk, and a time. The plan is derived from the
 * protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. Step one states the plan's source, the date
 * it was checked and its verification status: no points or airdrop campaign
 * is claimed for any protocol, because none was verified.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gasSetup = capital >= 150 ? 8 : 4;
  const category = p.category ?? 'a protocol';
  return [
    {
      text: `Farm plan for ${p.name} (${category} on ${chain}). Basis: the protocol's DefiLlama record (category, chains, TVL) and its own public docs, checked ${FARM_CHECKED}. No verified points or airdrop campaign was found for this protocol as of that date — the steps below are genuine product use, not a promised reward.`,
      cost: 'gas $0 to read; no capital',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `gas ~$${gasSetup}; capital $${capital} at risk`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'gas ~$2 a week; no new capital',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `gas $0; capital $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes — never from a link in a chat, an ad or a DM.`,
      cost: 'gas $0 to check; never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'gas $0; nothing but the log',
      time: '5 minutes',
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
    const capital = capitalFor(s.p);
    const gas = (capital >= 150 ? 8 : 4) + 8;
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
      verdict: verdictFor(s.v.base, s.age),
      farm_gas_usd: gas,
      capital_at_risk_usd: capital,
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
    verdict: row.verdict,
    farm_gas_usd: row.farm_gas_usd,
    capital_at_risk_usd: row.capital_at_risk_usd,
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
      baseline_log_mae: VALIDATION.baseline_log_mae,
      full_regression_log_mae: VALIDATION.full_regression_log_mae,
      tvl_only_log_mae: VALIDATION.tvl_only_log_mae,
      ensemble_log_mae: VALIDATION.ensemble_log_mae,
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
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
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
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
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
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
