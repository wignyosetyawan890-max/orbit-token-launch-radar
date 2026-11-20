import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL,
  SnapshotError,
  ageDays,
  bandOf,
  boardIssue,
  buildBoard,
  buildRadar,
  categoryPlan,
  comparableRows,
  confidenceFor,
  dataScript,
  explorerRows,
  farmSteps,
  fittedComparables,
  impliedValue,
  liveRows,
  parseSnapshot,
  radarRow,
  researchPriorityFor,
  tokenCensus,
} from '../lib/model.ts';

const fixture = {
  as_of: '2026-11-20',
  source: 'DefiLlama https://api.llama.fi/protocols, fetched 2026-11-20T00:00:00Z',
  floor_usd: 50_000_000,
  protocols: [
    { slug: 'protocol-alpha', name: 'Protocol Alpha', category: 'Dexs', chains: ['Ethereum'], tvl_usd: 80_000_000, change_7d: 2.5, mcap_usd: null, listed_at: '2024-01-01', gecko_id: null, symbol: null },
    { slug: 'early-beta', name: 'Early Beta', category: 'Dexs', chains: ['Base'], tvl_usd: 40_000_000, change_7d: -1, mcap_usd: null, listed_at: '2025-05-01', gecko_id: null, symbol: null },
    { slug: 'early-gamma', name: 'Early Gamma', category: 'Lending', chains: ['Arbitrum'], tvl_usd: 15_000_000, change_7d: 5, mcap_usd: null, listed_at: null, gecko_id: null, symbol: null },
    { slug: 'comp-dex', name: 'Comparable Dex', category: 'Dexs', chains: ['Ethereum'], tvl_usd: 120_000_000, change_7d: 0.2, mcap_usd: 80_000_000, listed_at: '2021-01-01', gecko_id: 'comp-dex-token', symbol: 'CDX' },
    { slug: 'comp-lend', name: 'Comparable Lend', category: 'Lending', chains: ['Arbitrum'], tvl_usd: 70_000_000, change_7d: 1.2, mcap_usd: 30_000_000, listed_at: '2022-01-01', gecko_id: 'comp-lend-token', symbol: 'CLD' },
  ],
  watchlist: ['protocol-alpha'],
};

function parsedFixture() {
  return parseSnapshot(JSON.stringify(fixture));
}

test('snapshot parser accepts a valid frozen snapshot and preserves the authoritative watchlist', () => {
  const snapshot = parsedFixture();
  assert.equal(snapshot.as_of, fixture.as_of);
  assert.deepEqual(snapshot.watchlist, ['protocol-alpha']);
  assert.equal(snapshot.protocols.length, 5);
});

test('snapshot parser rejects duplicate slugs and dangling watchlist entries', () => {
  const duplicate = structuredClone(fixture);
  duplicate.protocols.push(structuredClone(duplicate.protocols[0]));
  assert.throws(() => parseSnapshot(JSON.stringify(duplicate)), SnapshotError);

  const dangling = structuredClone(fixture);
  dangling.watchlist.push('not-in-snapshot');
  assert.throws(() => parseSnapshot(JSON.stringify(dangling)), /missing slug/);
});

test('snapshot parser accepts the sealed snapshot\u2019s negative-mcap sentinel (dead token, mcap -1)', () => {
  // Regression: the real frozen snapshot carries mcap_usd = -1 for autofinance (and 0 for
  // fifteen dead-token rows). That is DefiLlama's "no usable market cap" sentinel, not a
  // malformed row: parsing must accept it and the row must stay out of the comparables.
  const dead = structuredClone(fixture);
  dead.protocols[3].mcap_usd = -1;
  const snapshot = parseSnapshot(JSON.stringify(dead));
  assert.equal(snapshot.protocols[3].mcap_usd, -1);
  const board = buildBoard(snapshot);
  assert.equal(boardIssue(board, snapshot), null);
  assert.deepEqual(board.map((row) => row.rank), [1, 2, 3]);
});

test('snapshot parser rejects negative TVL and invalid dates', () => {
  const negative = structuredClone(fixture);
  negative.protocols[0].tvl_usd = -1;
  assert.throws(() => parseSnapshot(JSON.stringify(negative)), /non-negative TVL/);

  const invalidDate = structuredClone(fixture);
  invalidDate.as_of = '2026-02-30';
  assert.throws(() => parseSnapshot(JSON.stringify(invalidDate)), /valid UTC as_of date/);
});

test('board covers watchlist, has stable ranks, descending values and research-only evidence', () => {
  const snapshot = parsedFixture();
  const board = buildBoard(snapshot);
  assert.equal(boardIssue(board, snapshot), null);
  assert.deepEqual(board.map((row) => row.rank), [1, 2, 3]);
  assert.equal(board[0].slug, 'protocol-alpha');
  assert.ok(board.every((row) => row.campaign_status === 'unverified'));
  assert.ok(board.every((row) => row.evidence_status === 'snapshot-only'));
  assert.ok(board.every((row) => row.farm_gas_usd === null && row.capital_at_risk_usd === null));
  assert.ok(board.every((row) => ['review', 'watch', 'low'].includes(row.research_priority)));
  assert.ok(board.every((row) => row.farm_steps.length === 7));
  assert.ok(board.every((row) => row.farm_steps.every((step) => step.length >= 20 && step.length <= 600)));
});

test('farm plan is category-specific, not one generic checklist', () => {
  const dex = { slug: 'dex-one', name: 'Dex One', category: 'Dexs', chains: ['Ethereum'], tvl_usd: 80_000_000, change_7d: 2.5, mcap_usd: null, listed_at: '2024-01-01', gecko_id: null, symbol: null };
  const lend = { slug: 'lend-one', name: 'Lend One', category: 'Lending', chains: ['Ethereum'], tvl_usd: 80_000_000, change_7d: 2.5, mcap_usd: null, listed_at: '2024-01-01', gecko_id: null, symbol: null };
  const dexSteps = farmSteps(dex, 300).map((s) => `${s.text} Cost: ${s.cost}. Time: ${s.time}.`);
  const lendSteps = farmSteps(lend, 300).map((s) => `${s.text} Cost: ${s.cost}. Time: ${s.time}.`);
  assert.equal(dexSteps.length, 7);
  assert.notEqual(dexSteps[2], lendSteps[2]);
  assert.notEqual(dexSteps[3], lendSteps[3]);
  assert.notEqual(dexSteps[5], lendSteps[5]);
  assert.match(dexSteps[2], /swap/i);
  assert.match(lendSteps[2], /borrow/i);
  assert.ok(dexSteps.every((s) => s.includes('Dex One')));
  assert.ok(lendSteps.every((s) => s.includes('Lend One')));
  // Every category plan in the board's 30 categories resolves, never falls back silently for a known category.
  for (const cat of ['Risk Curators', 'RWA', 'Yield', 'CDP', 'Derivatives', 'Chain', 'Restaking', 'Insurance', 'Payments', 'Indexes']) {
    assert.notEqual(categoryPlan(cat).a, categoryPlan(null).a);
  }
  assert.equal(categoryPlan('Not A Category').a, categoryPlan(null).a);
});

test('farm plan never fabricates a campaign, reward, deposit or cost', () => {
  const snapshot = parsedFixture();
  const board = buildBoard(snapshot);
  for (const row of board) {
    for (const step of row.farm_steps) {
      assert.doesNotMatch(step, /confirmed campaign|guaranteed reward|airdrop confirmed/i);
      assert.doesNotMatch(step, /\$\d+(\.\d+)?\s*(gas|deposit|minimum|fee)/i);
      assert.doesNotMatch(step, /deposit \$|send \$|invest \$/i);
    }
    assert.ok(row.farm_steps[4].includes('UNVERIFIED'));
    assert.ok(row.farm_steps.some((s) => s.includes('not estimable from this snapshot')));
  }
});

test('farm plan step 2 is never truncated on many-chain protocols', () => {
  // Regression: vfat.io (39 chains) and steer-protocol (45 chains) had their
  // step 2 cut at the 600-character gate, losing the Cost/Time tail.
  const manyChains = Array.from({ length: 45 }, (_, i) => `Chain${i + 1}`);
  const p = { slug: 'many-chain', name: 'Many Chain', category: 'Dexs', chains: manyChains, tvl_usd: 80_000_000, change_7d: 2.5, mcap_usd: null, listed_at: '2024-01-01', gecko_id: null, symbol: null };
  const steps = farmSteps(p, 300).map((s) => `${s.text} Cost: ${s.cost}. Time: ${s.time}.`);
  assert.equal(steps.length, 7);
  assert.ok(steps.every((s) => s.length >= 20 && s.length <= 600));
  assert.ok(steps.every((s) => s.includes('Cost:') && s.includes('Time:')));
  assert.doesNotMatch(steps[1], /\.\.\.$/);
  assert.match(steps[1], /45 chains in total/);
});

test('quality gate rejects fabricated cost estimates', () => {
  const snapshot = parsedFixture();
  const board = buildBoard(snapshot);
  board[0].farm_gas_usd = 8;
  assert.match(boardIssue(board, snapshot), /unsupported cost estimates/);
});

test('radar data exposes distinct validation populations and deterministic serialization', () => {
  const snapshot = parsedFixture();
  const a = buildRadar(snapshot);
  const b = buildRadar(snapshot);
  assert.equal(a.radar.validation.cv_unique_tokens, 128);
  assert.equal(a.radar.validation.cv_predictions_per_candidate, 512);
  assert.equal(a.radar.validation.calibration_oof_predictions, 376);
  assert.equal(a.radar.validation.weighted_knn_log_mae, 0.7662164277193769);
  assert.equal(dataScript(a.radar), dataScript(b.radar));
  assert.equal(JSON.stringify(a.board), JSON.stringify(b.board));
});

test('implied value uses the fitted TVL-only model constants', () => {
  assert.equal(MODEL.a, 3.907676356741851);
  assert.equal(MODEL.b, 0.4048681580536768);
  assert.equal(MODEL.comparables, 94);
  const v = impliedValue({ tvl_usd: 100_000_000 });
  assert.equal(v.band, '100M-1B');
  assert.equal(v.base, Math.max(1, Math.round(10 ** (MODEL.a + MODEL.b * 8))));
  assert.ok(v.low <= v.base && v.high >= v.base);
  assert.deepEqual(impliedValue({ tvl_usd: 0 }), { base: 1, low: 1, high: 1, logTvl: 0, band: '<10M', bandP10: 0, bandP90: 0 });
});

test('TVL bands split at 10M, 50M, 100M and 1B', () => {
  assert.equal(bandOf(9_999_999), '<10M');
  assert.equal(bandOf(10_000_000), '10-50M');
  assert.equal(bandOf(49_999_999), '10-50M');
  assert.equal(bandOf(50_000_000), '50-100M');
  assert.equal(bandOf(99_999_999), '50-100M');
  assert.equal(bandOf(100_000_000), '100M-1B');
  assert.equal(bandOf(999_999_999), '100M-1B');
  assert.equal(bandOf(1_000_000_000), '>1B');
});

test('age in days counts whole days, clamps the future at zero, null without a date', () => {
  assert.equal(ageDays('2026-11-20', '2026-11-20'), 0);
  assert.equal(ageDays('2026-11-20', '2026-11-19'), 1);
  assert.equal(ageDays('2026-11-20', '2026-11-21'), 0);
  assert.equal(ageDays('2026-11-20', null), null);
});

test('research priority thresholds: review needs value and age, watch needs value, else low', () => {
  assert.equal(researchPriorityFor(30_000_000, 200), 'review');
  assert.equal(researchPriorityFor(25_000_000, 180), 'review');
  assert.equal(researchPriorityFor(30_000_000, 179), 'watch');
  assert.equal(researchPriorityFor(30_000_000, null), 'watch');
  assert.equal(researchPriorityFor(10_000_000, 900), 'watch');
  assert.equal(researchPriorityFor(9_999_999, 900), 'low');
  assert.equal(researchPriorityFor(5_000_000, null), 'low');
});

test('confidence follows interval width and same-category comparable count', () => {
  assert.equal(confidenceFor('100M-1B', 3), 'high');
  assert.equal(confidenceFor('100M-1B', 2), 'medium');
  assert.equal(confidenceFor('<10M', 9), 'medium');
  assert.equal(confidenceFor('>1B', 9), 'low');
});

test('token census counts unique ids, duplicates and valid comparables on the fixture', () => {
  const census = tokenCensus(parsedFixture());
  assert.deepEqual(census, { unique_gecko_id: 2, duplicated_gecko_id: 0, valid_comparables: 2, fitted_comparables: 2 });
});

test('fitted comparables exclude dead-token rows with non-positive market cap', () => {
  const dead = structuredClone(fixture);
  dead.protocols[3].mcap_usd = -1;
  const snapshot = parseSnapshot(JSON.stringify(dead));
  const comps = fittedComparables(snapshot);
  assert.equal(comps.length, 1);
  assert.equal(comps[0].slug, 'comp-lend');
  assert.equal(tokenCensus(snapshot).valid_comparables, 1);
});

test('live rows, explorer rows and comparable rows split the fixture correctly', () => {
  const snapshot = parsedFixture();
  const live = liveRows(snapshot);
  assert.deepEqual(live.map((r) => r.slug), ['comp-dex', 'comp-lend']);
  const all = explorerRows(snapshot);
  assert.deepEqual(all.map((r) => r.slug), ['comp-dex', 'protocol-alpha', 'comp-lend', 'early-beta', 'early-gamma']);
  assert.deepEqual(all.map((r) => r.token_status), ['live', 'pre-token', 'live', 'pre-token', 'pre-token']);
  assert.deepEqual(comparableRows(snapshot).map((r) => r.slug), ['comp-dex', 'comp-lend']);
});

test('radar rows are compact: band kept, farm steps generated in the page', () => {
  const snapshot = parsedFixture();
  const row = radarRow(buildBoard(snapshot)[0]);
  assert.equal(row.slug, 'protocol-alpha');
  assert.equal(typeof row.band, 'string');
  assert.equal('farm_steps' in row, false);
  assert.equal(row.campaign_status, 'unverified');
  assert.equal(row.farm_gas_usd, null);
});

test('data script is a single window.RADAR assignment with a trailing newline', () => {
  const { radar } = buildRadar(parsedFixture());
  const script = dataScript(radar);
  assert.ok(script.startsWith('window.RADAR='));
  assert.ok(script.endsWith(';\n'));
  assert.equal(script.trim().split('\n').length, 1);
});

test('quality gate rejects missing watchlist, broken order and bad intervals', () => {
  const snapshot = parsedFixture();
  const board = buildBoard(snapshot);
  const missing = board.filter((r) => r.slug !== 'protocol-alpha');
  assert.match(boardIssue(missing, snapshot), /misses 1 watchlist slug/);
  const swapped = [board[1], board[0], board[2]];
  assert.match(boardIssue(swapped, snapshot), /outranks/);
  const badInterval = structuredClone(board);
  badInterval[0].low_value_usd = badInterval[0].implied_value_usd + 1;
  assert.match(boardIssue(badInterval, snapshot), /interval that does not hold/);
});

test('snapshot parser rejects malformed documents and duplicate watchlist slugs', () => {
  assert.throws(() => parseSnapshot('not json'), SnapshotError);
  const dupWatch = structuredClone(fixture);
  dupWatch.watchlist.push('protocol-alpha');
  assert.throws(() => parseSnapshot(JSON.stringify(dupWatch)), /duplicate watchlist/);
  const badFloor = structuredClone(fixture);
  badFloor.floor_usd = 0;
  assert.throws(() => parseSnapshot(JSON.stringify(badFloor)), /floor_usd/);
  const empty = structuredClone(fixture);
  empty.protocols = [];
  assert.throws(() => parseSnapshot(JSON.stringify(empty)), /protocols/);
});
