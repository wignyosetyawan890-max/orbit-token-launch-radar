// ORBIT — Token Launch Intelligence. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs, the fitted comparables and a research-only campaign verification checklist, plus the live-token view and the full
// snapshot-wide explorer. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null, tvlMin: 0, growthMin: null, valMin: 0, priority: 'all' };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row, model) {
    if (!(row.tvl_usd > 0)) return 1;
    return Math.max(1, Math.round(Math.pow(10, model.a + model.b * Math.log10(row.tvl_usd))));
  }
  function rangeOf(row, model) {
    var band = model.bands[row.band];
    if (!band || !(row.tvl_usd > 0)) return { low: row.low_value_usd, high: row.high_value_usd };
    var baseLog = model.a + model.b * Math.log10(row.tvl_usd);
    return { low: Math.max(1, Math.round(Math.pow(10, baseLog + band.p10))), high: Math.max(1, Math.round(Math.pow(10, baseLog + band.p90))) };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // Snapshot-only due diligence. A protocol category, chain list or TVL is not
  // evidence of a campaign, contract, eligible action, cost or required capital.
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s += ' Verify primary sources before action.';
    return s;
  }
  // Category-specific product actions, keyed by the snapshot's own DefiLlama
  // category. Mirrors lib/model.ts exactly: same plan per category, same
  // seven steps, same UNVERIFIED status. No campaign, reward, deposit,
  // contract, amount or gas budget is invented anywhere here.
  var CATEGORY_PLANS = {
    'Dexs': { a: "Open the swap interface and check available trading pairs, quoted price, slippage and pool depth", b: "Check liquidity provision: pool composition, fee tier, share of pool and impermanent-loss exposure", risk: "impermanent loss, slippage, pool fee changes and smart-contract risk" },
    'Lending': { a: "Review the supply and borrow markets: available assets, interest rates, collateral factors and liquidation thresholds", b: "Check a borrow position health factor and liquidation price with the protocol own calculator before borrowing", risk: "liquidation, interest-rate changes, oracle failure and bad-debt risk" },
    'Risk Curators': { a: "Review the curator vaults: strategy description, allocated markets, caps and historical allocation changes", b: "Compare the curator stated risk limits with the vault actual exposures and withdrawal terms", risk: "curator allocation decisions, vault strategy drift, withdrawal delays and smart-contract risk" },
    'RWA': { a: "Identify the underlying real-world asset, issuer, custodian and redemption process from official documentation", b: "Check token holder rights, transfer restrictions, minimums and redemption timelines as published by the issuer", risk: "issuer and custodian counterparty risk, redemption restrictions, regulatory and valuation risk" },
    'Yield': { a: "Read the yield strategy: where yield comes from, underlying venues, and how returns are calculated and distributed", b: "Check the strategy historical returns, fees, withdrawal terms and what happens when underlying yield falls", risk: "strategy underperformance, underlying venue risk, fee drag and withdrawal constraints" },
    'Onchain Capital Allocator': { a: "Review the allocator strategy, target venues, allocation weights and rebalancing rules", b: "Check performance reporting, fees, and how capital is moved between venues", risk: "allocation decisions, venue concentration, rebalancing and smart-contract risk" },
    'Derivatives': { a: "Review the trading markets: instruments offered, leverage limits, funding rates and liquidation rules", b: "Check margin requirements, maintenance margin and the liquidation process for a position", risk: "liquidation, funding-rate costs, oracle and market-volatility risk" },
    'CDP': { a: "Review the collateral types, minimum collateral ratios, stability fees and minting limits", b: "Check the liquidation ratio and the process for repaying debt and unlocking collateral", risk: "liquidation on collateral price falls, peg deviation, oracle and stability-fee risk" },
    'Yield Aggregator': { a: "Review the aggregated vaults: underlying strategies, auto-compounding mechanics and fee structure", b: "Check deposit and withdrawal terms, lockups and how harvested yield is reinvested", risk: "underlying strategy risk, compounding assumptions, fees and withdrawal constraints" },
    'Basis Trading': { a: "Review the basis strategy: spot versus futures positions, funding-rate exposure and hedging mechanics", b: "Check how the strategy performs when funding rates turn negative and how positions are unwound", risk: "funding-rate reversal, exchange counterparty and liquidation risk" },
    'Chain': { a: "Identify the chain native asset, gas token, consensus and the applications that hold its TVL", b: "Check bridging routes, gas costs and finality for moving assets to and from this chain", risk: "bridge risk, gas volatility, chain downtime and application-level risk" },
    'Staking Pool': { a: "Review the staking pool: staked asset, validator set, reward rate and unbonding period", b: "Check pool fees, slashing conditions and how rewards are distributed", risk: "slashing, validator failure, unbonding delays and reward variability" },
    'Liquidity Manager': { a: "Review the managed liquidity positions: price ranges, rebalancing rules and fee collection", b: "Check how ranges are adjusted in volatile markets and what fees the manager charges", risk: "impermanent loss, range mis-setting, rebalancing and smart-contract risk" },
    'Restaking': { a: "Review what is restaked, which services are secured, and the additional slashing conditions", b: "Check withdrawal queues, unbonding periods and how restaking rewards are paid", risk: "additional slashing, operator failure and withdrawal delays" },
    'CeDeFi': { a: "Identify the centralised counterparties: custodian, exchange venues and how funds are held", b: "Check proof of reserves or attestations, withdrawal processes and counterparty disclosures", risk: "custodian and exchange counterparty risk, withdrawal freezes and disclosure gaps" },
    'Anchor BTC': { a: "Check how the BTC-pegged asset is backed, where the underlying BTC is held, and mint and redeem mechanics", b: "Verify the peg history, redemption process and any mint or redeem limits or fees", risk: "peg deviation, custodian risk, redemption delays and bridge risk" },
    'Decentralized BTC': { a: "Check the decentralised BTC mechanism: collateral, minting process and peg maintenance", b: "Review redemption rights, collateral ratios and what happens on a peg break", risk: "peg deviation, collateral liquidation and oracle risk" },
    'Leveraged Farming': { a: "Review the leveraged position: leverage ratio, borrowed assets, and the farming venues used", b: "Check liquidation thresholds, interest costs and how the position is closed", risk: "liquidation, borrowing costs, farming yield shortfall and smart-contract risk" },
    'Dual-Token Stablecoin': { a: "Review the two-token design: which token is the stablecoin, which absorbs volatility, and mint and redeem rules", b: "Check peg mechanisms, collateral backing and redemption terms for each token", risk: "peg deviation, collateral shortfall and mechanism failure" },
    'Insurance': { a: "Review the coverage offered: covered risks, policy terms, premiums and claim conditions", b: "Check the claims process, payout history and capital backing the cover", risk: "claim denial, underwriting losses and capital adequacy risk" },
    'Payments': { a: "Review the payment flow: supported assets, settlement networks, fees and settlement times", b: "Check sender and receiver requirements, limits and refund or dispute handling", risk: "settlement failure, fee changes and counterparty risk" },
    'Governance Incentives': { a: "Review the governance system: voting power, proposal process and incentive distribution", b: "Check eligibility for incentives, lockups and how rewards are claimed", risk: "governance capture, incentive changes and lockup risk" },
    'Stablecoin Wrapper': { a: "Review the wrapped stablecoin: underlying reserve asset, mint and redeem process and peg", b: "Check redemption limits, fees and reserve attestations", risk: "peg deviation, reserve shortfall and redemption restrictions" },
    'Collateral Markets': { a: "Review the collateral markets: accepted collateral, loan terms and interest rates", b: "Check collateral ratios, liquidation rules and withdrawal terms", risk: "liquidation, collateral price falls and oracle risk" },
    'Crypto Card Issuer': { a: "Review the card product: supported assets, spending limits, fees and supported regions", b: "Check card issuance requirements, top-up process and settlement asset", risk: "issuer risk, regional restrictions, fees and settlement delays" },
    'Farm': { a: "Review the farming pools: reward tokens, emission schedules and pool requirements", b: "Check staking and deposit terms, reward claim process and lockups", risk: "reward token price falls, emission changes, lockups and smart-contract risk" },
    'Uncollateralized Lending': { a: "Review the credit model: borrower assessment, credit limits and repayment terms", b: "Check default handling, recovery process and lender protections", risk: "borrower default, credit assessment failure and limited recourse" },
    'Prediction Market': { a: "Review the markets offered, resolution rules and how outcomes are determined", b: "Check trading fees, liquidity, settlement times and dispute resolution", risk: "resolution disputes, low liquidity and outcome uncertainty" },
    'Indexes': { a: "Review the index composition: constituent assets, weights and rebalancing schedule", b: "Check mint and redeem mechanics, fees and tracking against the stated index", risk: "tracking error, constituent changes, rebalancing and smart-contract risk" },
    'Interest Rate Derivatives': { a: "Review the rate products: fixed versus floating rates, maturities and settlement", b: "Check pricing, collateral requirements and how positions are closed or settled", risk: "rate movements, counterparty, liquidity and settlement risk" }
  };
  var FALLBACK_PLAN = { a: "Read the protocol documentation to identify its core product actions and the assets and networks they use", b: "List the protocol stated user actions in order and check which require a wallet connection, deposit or signature", risk: "unknown product risk until documentation and contracts are verified" };
  function fmtTvl(tvl) {
    if (tvl >= 1e9) return '$' + (tvl / 1e9).toFixed(2) + 'B';
    if (tvl >= 1e6) return '$' + (tvl / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(tvl);
  }
  function verificationSteps(p) {
    var chains = p.chains && p.chains.length ? p.chains.join(', ') : 'not specified in snapshot';
    // Step 2 must stay inside the 600-character gate even for protocols on
    // 39-45 chains (vfat.io, steer-protocol): name the first five chains and
    // count the rest instead of listing every chain verbatim.
    var chainShort = (p.chains && p.chains.length > 5) ? p.chains.slice(0, 5).join(', ') + ' and ' + (p.chains.length - 5) + ' more chains' : chains;
    var chainCount = p.chains ? p.chains.length : 0;
    var category = p.category || 'not specified';
    var plan = CATEGORY_PLANS[p.category] || FALLBACK_PLAN;
    var ageText = (p.age_days === null || p.age_days === undefined) ? 'tracking age unavailable' : p.age_days + ' days tracked';
    var changeText = (p.change_7d === null || p.change_7d === undefined) ? '7-day change not reported' : p.change_7d.toFixed(2) + '% over 7 days';
    return [
      { text: 'Identify the authentic project for ' + p.name + ' (' + category + '). Snapshot 2026-11-14 records ' + fmtTvl(p.tvl_usd) + ' TVL, ' + changeText + ', ' + ageText + '; it contains no official website URL. Resolve the domain from a trusted, independently verified primary source before opening links or connecting a wallet.', cost: 'No on-chain cost; source verification only', time: '5–10 minutes' },
      { text: 'Verify deployment details for ' + p.name + '. The snapshot lists ' + chainShort + ' (' + chainCount + ' chains in total) but does not provide contract addresses, deployment versions, admin controls or audit status. Match every address against official documentation and the relevant chain explorer; do not infer contracts from token lists or search ads.', cost: 'Unknown until contracts and actions are verified; do not transact', time: '10–20 minutes' },
      { text: 'Product action for ' + p.name + ' (' + category + '): ' + plan.a + '. Do this only after steps 1-2 verify the official site and contracts, and record what the official interface actually offers.', cost: 'Review only; on-chain cost not estimable from this snapshot', time: '10–20 minutes' },
      { text: 'Second product action for ' + p.name + ': ' + plan.b + '. Record the exact options, limits and terms shown by the official interface; do not assume a feature, market or pool exists.', cost: 'Review only; on-chain cost not estimable from this snapshot', time: '10–20 minutes' },
      { text: 'Check whether ' + p.name + ' has an active points, rewards, testnet or airdrop campaign. Search only the protocol verified website, documentation and official announcement channels. No campaign field or campaign evidence is present in this frozen snapshot, so status remains UNVERIFIED, not confirmed active and not confirmed absent.', cost: 'No on-chain cost; evidence review only', time: '10–15 minutes' },
      { text: 'Build a transaction-level cost and risk sheet for ' + p.name + ' only after the exact eligible actions are known. Obtain a current gas quote, approval and execution fees, bridge or swap spread, exit cost, minimum capital, lockup and withdrawal constraints. Main category risks: ' + plan.risk + '. TVL cannot determine a safe capital amount.', cost: 'Not estimable from this snapshot; no capital or gas budget is provided', time: '10–20 minutes' },
      { text: 'Decision gate for ' + p.name + ': mark READY FOR USER REVIEW only when official campaign terms, contract addresses, costs, risks and eligibility are documented with dated primary-source evidence. Obtain the user explicit approval before any wallet connection, signature or transaction. If evidence is missing or ambiguous, record NO ACTION and keep campaign status UNVERIFIED.', cost: 'No transaction without evidence and explicit user approval', time: '5 minutes to document decision' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('priority')) state.priority = params.get('priority');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.priority !== 'all') params.set('priority', state.priority);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function boardRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.priority !== 'all' && r.research_priority !== state.priority) return false;
      if (state.tvlMin > 0 && r.tvl_usd < state.tvlMin) return false;
      if (state.growthMin !== null && (r.change_7d === null || r.change_7d < state.growthMin)) return false;
      if (state.valMin > 0 && r.implied_value_usd < state.valMin) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function explorerRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.all.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' '), r.token_status].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name' }, 'ORBIT ', el('em', { text: '| Token Launch Intelligence' }))),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by fitted implied value' }),
        el('p', null, 'The watchlist is the floor: every protocol with at least $', el('b', { text: Math.round(DATA.floor_usd / 1e6) + 'M' }), ' of TVL and no token on record. The early radar adds ', el('b', { text: String(DATA.early_size) }), ' pre-token protocols below that floor. Ranking is by a TVL-only implied-market-cap proxy; with a positive fitted slope, ordering is rank-equivalent to TVL. It is not token-launch probability, campaign eligibility or a price target.')
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Full explorer' }), el('b', { text: String(DATA.explorer_size) + ' protocols' })),
        el('div', { class: 'fact' }, el('span', { text: 'Fitted comparables' }), el('b', { text: String(DATA.comparable_size) + ' tokens' }))
      )
    );
  }

  function kpiStrip() {
    var v = DATA.validation;
    return el('div', { class: 'strip' },
      el('div', { class: 'kpi' }, el('span', { text: 'Model selection · 128 comparables' }), el('b', null, v.tvl_only_log_mae.toFixed(4), el('em', { text: ' vs ' + v.baseline_log_mae.toFixed(4) + ' baseline' })), el('small', { text: v.cv_repeats + ' repeats × ' + v.cv_folds + ' folds · ' + v.cv_predictions_per_candidate + ' held-out predictions per candidate' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Residual calibration · 94 fitted comparables' }), el('b', { text: DATA.model.oof_mae.toFixed(4) + ' log-MAE' }), el('small', { text: v.calibration_oof_predictions + ' repeated out-of-fold residual predictions; separate from the 128-token model selection CV' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Empirical residual interval' }), el('b', { text: 'x' + v.interval_80_low + ' – x' + v.interval_80_high }), el('small', { text: '10th–90th percentile residual multipliers; not a guaranteed future coverage rate' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Snapshot census' }), el('b', { text: String(v.unique_gecko_id) + ' unique IDs' }), el('small', { text: v.valid_comparables + ' valid market-cap comparables · ' + v.fitted_comparables + ' used in final fit' }))
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    function sel(id, label, options, current, onchange) {
      var s = el('select', { id: id, 'aria-label': label });
      options.forEach(function (o) {
        var opt = el('option', { value: String(o[0]), text: o[1] });
        if (String(o[0]) === String(current)) opt.setAttribute('selected', 'selected');
        s.appendChild(opt);
      });
      s.addEventListener('change', function () { onchange(s.value); writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label }), s);
    }
    var catSel = sel('category', 'Category', [['all', 'All categories']].concat(categories.map(function (c) { return [c, c]; })), state.category, function (v) { state.category = v; });
    var chainSel = sel('chain', 'Chain', [['all', 'All chains']].concat(chains.map(function (c) { return [c, c]; })), state.chain, function (v) { state.chain = v; });
    var tvlSel = sel('tvl', 'Min TVL', [['0', 'Any TVL'], ['1000000', 'TVL $1M+'], ['10000000', 'TVL $10M+'], ['50000000', 'TVL $50M+']], state.tvlMin, function (v) { state.tvlMin = Number(v); });
    var growthSel = sel('growth', '7d growth', [['', 'Any growth'], ['0', 'Growing (7d >= 0%)'], ['10', '7d >= +10%'], ['-10', '7d >= -10%']], state.growthMin === null ? '' : String(state.growthMin), function (v) { state.growthMin = v === '' ? null : Number(v); });
    var valSel = sel('val', 'Min implied value', [['0', 'Any value'], ['10000000', 'Implied $10M+'], ['25000000', 'Implied $25M+']], state.valMin, function (v) { state.valMin = Number(v); });
    var prioritySel = sel('priority', 'Research priority', [['all', 'Any priority'], ['review', 'Review first'], ['watch', 'Watch'], ['low', 'Low']], state.priority, function (v) { state.priority = v; });
    function tabBtn(tab, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label, onclick: function () { state.tab = tab; writeHash(); render(); } });
    }
    var count = state.tab === 'board' ? boardRows().length + ' rows shown' : state.tab === 'live' ? DATA.live.length + ' live-token protocols' : explorerRows().length + ' of ' + DATA.explorer_size + ' protocols';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      catSel, chainSel, tvlSel, growthSel, valSel, prioritySel,
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'View' }), el('div', { class: 'tabs' }, tabBtn('board', 'Board'), tabBtn('live', 'Live token'), tabBtn('explorer', 'Explorer 758'))),
      el('span', { class: 'count', text: count })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function priorityPill(v) {
    var label = v === 'review' ? 'Review first' : v === 'watch' ? 'Watch' : 'Low';
    return el('span', { class: 'pill ' + v, text: label });
  }

  function boardTable() {
    var list = sortedRows(boardRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another filter to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.priority = 'all'; state.tvlMin = 0; state.growthMin = null; state.valMin = 0;  writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num', text: fmtUsd(r.low_value_usd) + ' – ' + fmtUsd(r.high_value_usd) }),
        el('td', null, el('span', { class: 'conf ' + r.confidence, text: r.confidence + ' · ' + r.comparable_count + ' comps' })),
        el('td', null, el('span', { class: 'pill unverified', text: 'Unverified campaign' })),
        el('td', null, priorityPill(r.research_priority))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its valuation model, comparables and evidence checklist.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Low – high' }),
            el('th', { scope: 'col', text: 'Confidence' }),
            el('th', { scope: 'col', text: 'Campaign evidence' }),
            el('th', { scope: 'col', text: 'Research priority' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'pill live', text: 'live' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'pill', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function explorerTable() {
    var list = explorerRows();
    var key = state.sort;
    list = list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.listed_at === null ? Infinity : a.listed_at; bv = b.listed_at === null ? Infinity : b.listed_at; }
      else { av = a.tvl_usd; bv = b.tvl_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
    var tbody = el('tbody');
    list.slice(0, 200).forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'pill ' + (r.token_status === 'pre-token' ? 'pre' : 'live'), text: r.token_status === 'pre-token' ? 'no token' : 'live' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.listed_at || 'n/a' })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'All ' + DATA.explorer_size + ' protocols in the snapshot, by TVL (first 200 shown; narrow with search or filters). Pre-token rows record no token; live rows already trade.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Token' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Tracked since' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var v = DATA.validation;
    function pctVsBase(score) { return ((score / v.baseline_log_mae - 1) * 100).toFixed(1) + '%'; }
    return el('section', { class: 'panel model' },
      el('h2', { text: 'Valuation model · evidence and limitations' }),
      el('p', { class: 'sub', text: 'The model estimates an implied market-cap proxy from frozen-snapshot TVL. It does not estimate token-launch probability, reward probability, price performance or campaign eligibility. Because the fitted TVL slope is positive and there is no second ranking feature in the shipped model, board order is mathematically equivalent to sorting by TVL.' }),
      el('div', { class: 'formula' },
        el('b', { text: 'log10(implied mcap) = ' + m.a.toFixed(4) + ' + ' + m.b.toFixed(4) + ' × log10(TVL)' }),
        '   ·   final fit: ' + m.comparables + ' transferable comparables   ·   separate out-of-fold residual calibration'
      ),
      el('h3', { text: 'Model selection · 128 unique comparable tokens' }),
      el('p', { class: 'sub', text: v.cv_repeats + ' repeats × ' + v.cv_folds + ' grouped folds by CoinGecko ID = ' + v.cv_predictions_per_candidate + ' held-out predictions per candidate. Scores below belong to this same 128-token evaluation population.' }),
      el('table', { class: 'evidence' },
        el('thead', null, el('tr', null, el('th', { text: 'Candidate model' }), el('th', { class: 'num', text: 'Out-of-sample log-MAE' }), el('th', { class: 'num', text: 'vs baseline' }))),
        el('tbody', null,
          el('tr', null, el('td', { text: 'M0 robust median mcap/TVL multiple · baseline' }), el('td', { class: 'num', text: v.baseline_log_mae.toFixed(4) }), el('td', { class: 'num', text: 'Reference' })),
          el('tr', null, el('td', { text: 'M1 category-shrunk multiple' }), el('td', { class: 'num', text: v.category_shrunk_log_mae.toFixed(4) }), el('td', { class: 'num', text: pctVsBase(v.category_shrunk_log_mae) })),
          el('tr', null, el('td', { text: 'M2 full log-mcap regression · TVL + growth + age' }), el('td', { class: 'num', text: v.full_regression_log_mae.toFixed(4) }), el('td', { class: 'num', text: pctVsBase(v.full_regression_log_mae) })),
          el('tr', null, el('td', { text: 'M3 weighted k-nearest neighbours · k=8' }), el('td', { class: 'num', text: v.weighted_knn_log_mae.toFixed(4) }), el('td', { class: 'num', text: pctVsBase(v.weighted_knn_log_mae) })),
          el('tr', null, el('td', { text: 'M4 validation-weighted ensemble' }), el('td', { class: 'num', text: v.ensemble_log_mae.toFixed(4) }), el('td', { class: 'num', text: pctVsBase(v.ensemble_log_mae) })),
          el('tr', { class: 'winner' }, el('td', { text: 'M2 TVL-only · shipped' }), el('td', { class: 'num', text: v.tvl_only_log_mae.toFixed(4) }), el('td', { class: 'num', text: pctVsBase(v.tvl_only_log_mae) }))
        )
      ),
      el('p', { class: 'sub', text: 'The TVL-only candidate is the best score among the 128-token candidates shown. M3 was evaluated as a predictive kNN candidate; the detail drawer’s nearest-comparable list is a separate descriptive lookup, not the kNN predictor.' }),
      el('h3', { text: 'Final fit and residual calibration · separate 94-token population' }),
      el('p', { class: 'sub', text: 'The production coefficients were refit on 94 deduplicated comparables after excluding Bridge, Canonical Bridge, CEX, Liquid Staking, Liquid Restaking and Restaked BTC. On a separate repeated CV over that transferable subset, TVL-only log-MAE was ' + v.reduced_tvl_only_log_mae.toFixed(4) + ' versus ' + v.reduced_baseline_log_mae.toFixed(4) + ' for its subset baseline. Residual calibration uses ' + v.calibration_oof_predictions + ' repeated out-of-fold predictions and has MAE ' + m.oof_mae.toFixed(4) + '. These values must not be compared as though they share the same evaluation set.' }),
      el('p', { class: 'sub', text: 'Growth and age were tested and not shipped. The full regression growth coefficient was ' + v.growth_coefficient + '; the full feature set performed worse than TVL-only in the 128-token comparison. The 80% residual interval is x' + v.interval_80_low + ' to x' + v.interval_80_high + ' of the base estimate. This is an empirical historical residual range, not a guarantee of future coverage.' }),
      el('p', { class: 'sub', text: 'Snapshot census: ' + v.unique_gecko_id + ' unique CoinGecko IDs, ' + v.duplicated_gecko_id + ' duplicate IDs, ' + v.valid_comparables + ' valid market-cap comparables, ' + v.fitted_comparables + ' final-fit comparables.' }),
      el('div', { class: 'warn' }, el('b', { text: 'Research priority is not a farm recommendation. ' }), 'The snapshot has no verified official URLs, contract addresses, live campaign terms, eligibility rules, gas quotes or capital requirements. All campaign statuses remain UNVERIFIED. The checklist below is research-only; it never tells a user to deposit, swap, bridge, stake or sign.')
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function nearestComps(row) {
    var target = Math.log10(row.tvl_usd);
    var same = DATA.comps.filter(function (c) { return c.category === row.category; });
    return same.map(function (c) { return { c: c, d: Math.abs(Math.log10(c.tvl_usd) - target) }; })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, 5)
      .map(function (x) { return x.c; });
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = verificationSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    var range = rangeOf(row, DATA.model);
    var comps = nearestComps(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'log10(TVL)' }), el('b', { class: 'num', text: String(Math.round(Math.log10(row.tvl_usd) * 10000) / 10000) })),
        el('div', null, el('span', { text: 'TVL band' }), el('b', { class: 'num', text: row.band })),
        el('div', null, el('span', { text: 'Low (10th pct of residuals)' }), el('b', { class: 'num', text: fmtUsd(row.low_value_usd) })),
        el('div', null, el('span', { text: 'Base implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'High (90th pct of residuals)' }), el('b', { class: 'num', text: fmtUsd(row.high_value_usd) })),
        el('div', null, el('span', { text: 'Confidence' }), el('b', { class: 'num', text: row.confidence + ' · ' + row.comparable_count + ' same-category comparables' }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': log10(mcap) = ' + DATA.model.a.toFixed(4) + ' + ' + DATA.model.b.toFixed(4) + ' x log10(TVL). The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd && range.low === row.low_value_usd && range.high === row.high_value_usd ? ', the same numbers board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    var compSection = el('section', { class: 'detail-section' }, el('h3', { text: 'Fitted comparables' }));
    if (comps.length === 0) {
      compSection.appendChild(el('p', { class: 'sub', text: 'No fitted comparable shares this category, so the value rests on the global fit alone.' }));
    } else {
      var cbody = el('tbody');
      comps.forEach(function (c) {
        var pred = impliedOf(c, DATA.model);
        var ratio = c.mcap_usd !== null && pred > 0 ? c.mcap_usd / pred : null;
        cbody.appendChild(el('tr', null,
          el('td', { text: c.name }),
          el('td', { class: 'num', text: fmtUsd(c.tvl_usd) }),
          el('td', { class: 'num', text: fmtUsd(c.mcap_usd) }),
          el('td', { class: 'num', text: fmtUsd(pred) }),
          el('td', { class: 'num', text: ratio === null ? 'n/a' : 'x' + ratio.toFixed(2) })
        ));
      });
      compSection.appendChild(el('table', { class: 'comps' },
        el('thead', null, el('tr', null, el('th', { text: 'Traded token' }), el('th', { text: 'TVL' }), el('th', { text: 'Actual mcap' }), el('th', { text: 'Model says' }), el('th', { text: 'Actual / model' }))),
        cbody
      ));
      compSection.appendChild(el('p', { class: 'sub', text: 'The nearest traded tokens in the same category, by TVL. The model was fitted on 94 such tokens; a ratio far from x1.00 is normal — the 80% interval is x0.06 to x9.77.' }));
    }
    dialog.appendChild(compSection);
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Campaign verification playbook · research only' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Evidence status and risk controls' }),
      el('div', { class: 'kv' },
        el('div', null, el('span', { text: 'Campaign status' }), el('b', { text: 'UNVERIFIED' })),
        el('div', null, el('span', { text: 'Evidence source' }), el('b', { text: 'Snapshot only' })),
        el('div', null, el('span', { text: 'Research priority' }), el('b', { text: row.research_priority.toUpperCase() })),
        el('div', null, el('span', { text: 'Gas estimate' }), el('b', { text: 'Not available' })),
        el('div', null, el('span', { text: 'Capital requirement' }), el('b', { text: 'Not available' })),
        el('div', null, el('span', { text: 'Valuation confidence' }), el('b', { text: row.confidence }))
      ),
      el('p', { class: 'sub', text: row.research_priority_reason + ' The frozen input has no campaign, contract, eligibility or transaction-cost evidence. Never connect a wallet, sign or transact solely because a protocol ranks highly. Obtain current primary-source evidence and explicit user approval first.' })
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(kpiStrip());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'board' ? boardTable() : state.tab === 'live' ? liveTable() : explorerTable());
    if (state.tab === 'board') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () {
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.priority = 'all'; state.selected = null;
    readHash();
    render();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
