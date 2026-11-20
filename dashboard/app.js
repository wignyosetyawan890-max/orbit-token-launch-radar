// ORBIT — Token Launch Intelligence. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs, the fitted comparables and the protocol's farm plan, plus the live-token view and the full
// 758-protocol explorer. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null, tvlMin: 0, growthMin: null, valMin: 0, farmMax: 0, verdict: 'all' };

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

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  // Gas is always stated apart from the capital at risk, and step one states the plan's source,
  // its check date and that no campaign was verified.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('perp') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gasSetup = capital >= 150 ? 8 : 4;
    var category = p.category || 'a protocol';
    return [
      { text: 'Farm plan for ' + p.name + ' (' + category + ' on ' + chain + '). Basis: the protocol\'s DefiLlama record (category, chains, TVL) and its own public docs, checked 2026-11-20. No verified points or airdrop campaign was found for this protocol as of that date — the steps below are genuine product use, not a promised reward.', cost: 'gas $0 to read; no capital', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: 'gas ~$' + gasSetup + '; capital $' + capital + ' at risk', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'gas ~$2 a week; no new capital', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'gas $0; capital $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes — never from a link in a chat, an ad or a DM.', cost: 'gas $0 to check; never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'gas $0; nothing but the log', time: '5 minutes' }
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
    if (params.get('verdict')) state.verdict = params.get('verdict');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
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
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (state.tvlMin > 0 && r.tvl_usd < state.tvlMin) return false;
      if (state.growthMin !== null && (r.change_7d === null || r.change_7d < state.growthMin)) return false;
      if (state.valMin > 0 && r.implied_value_usd < state.valMin) return false;
      if (state.farmMax > 0 && r.farm_gas_usd > state.farmMax) return false;
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
      else if (key === 'farm') { av = a.farm_gas_usd; bv = b.farm_gas_usd; }
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
        el('p', null, 'The watchlist is the floor: every protocol with at least $', el('b', { text: Math.round(DATA.floor_usd / 1e6) + 'M' }), ' of TVL and no token on record. The early radar adds ', el('b', { text: String(DATA.early_size) }), ' pre-token protocols below that floor. Implied value is a fitted model of what a token would be worth at current fundamentals — an estimate, not a price, and never a promised reward.')
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
      el('div', { class: 'kpi' }, el('span', { text: 'Out-of-sample log-MAE' }), el('b', null, '0.659 ', el('em', { text: 'vs 0.776 baseline' })), el('small', { text: 'repeated grouped 5-fold CV, n = 128 tokens' })),
      el('div', { class: 'kpi' }, el('span', { text: '80% interval, out-of-fold' }), el('b', { text: 'x0.06 – x9.77' }), el('small', { text: 'wide on purpose: the signal is weak' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Unique CoinGecko ids' }), el('b', { text: String(v.unique_gecko_id) }), el('small', { text: v.duplicated_gecko_id + ' duplicates · ' + v.valid_comparables + ' valid comparables' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(DATA.rows[0].implied_value_usd) }), el('small', { text: DATA.rows[0].name + ' · rank 1 of ' + DATA.board_size }))
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
    var farmSel = sel('farm', 'Max farm gas', [['0', 'Any gas cost'], ['12', 'Gas <= $12'], ['16', 'Gas <= $16']], state.farmMax, function (v) { state.farmMax = Number(v); });
    var verdictSel = sel('verdict', 'Farm verdict', [['all', 'Any verdict'], ['farm', 'Farm'], ['thin', 'Thin'], ['skip', 'Skip']], state.verdict, function (v) { state.verdict = v; });
    function tabBtn(tab, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label, onclick: function () { state.tab = tab; writeHash(); render(); } });
    }
    var count = state.tab === 'board' ? boardRows().length + ' rows shown' : state.tab === 'live' ? DATA.live.length + ' live-token protocols' : explorerRows().length + ' of ' + DATA.explorer_size + ' protocols';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      catSel, chainSel, tvlSel, growthSel, valSel, farmSel, verdictSel,
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

  function verdictPill(v) {
    return el('span', { class: 'pill ' + v, text: v === 'farm' ? 'Farm' : v === 'thin' ? 'Thin' : 'Skip' });
  }

  function boardTable() {
    var list = sortedRows(boardRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another filter to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.verdict = 'all'; state.tvlMin = 0; state.growthMin = null; state.valMin = 0; state.farmMax = 0; writeHash(); render(); } })
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
        el('td', { class: 'num', text: 'gas $' + r.farm_gas_usd + ' + $' + r.capital_at_risk_usd }),
        el('td', null, verdictPill(r.verdict))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model, comparables and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Low – high' }),
            el('th', { scope: 'col', text: 'Confidence' }),
            sortHeader('farm', 'Farm cost'),
            el('th', { scope: 'col', text: 'Verdict' })
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
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One fitted function scores every row. No protocol name is special-cased, and no row is hand-picked. The comparables are the snapshot\u2019s own traded tokens, deduplicated to one row per CoinGecko id.' }),
      el('div', { class: 'formula' },
        el('b', { text: 'log10(mcap) = ' + m.a.toFixed(4) + ' + ' + m.b.toFixed(4) + ' \u00d7 log10(TVL)' }),
        '   ·   fitted on ' + m.comparables + ' category-matched comparables   ·   low / high from out-of-fold residuals per TVL band'
      ),
      el('table', { class: 'evidence' },
        el('thead', null, el('tr', null, el('th', { text: 'Candidate model' }), el('th', { class: 'num', text: 'Out-of-sample log-MAE' }), el('th', { class: 'num', text: 'vs baseline' }))),
        el('tbody', null,
          el('tr', null, el('td', { text: 'M0 robust median mcap/TVL multiple (baseline)' }), el('td', { class: 'num', text: v.baseline_log_mae.toFixed(4) }), el('td', { class: 'num', text: '—' })),
          el('tr', null, el('td', { text: 'M1 category-adjusted multiple, shrunk' }), el('td', { class: 'num', text: '0.7983' }), el('td', { class: 'num', text: '-2.9% (worse)' })),
          el('tr', null, el('td', { text: 'M2 log-mcap regression, full (TVL + growth + age)' }), el('td', { class: 'num', text: v.full_regression_log_mae.toFixed(4) }), el('td', { class: 'num', text: '+6.4%' })),
          el('tr', null, el('td', { text: 'M4 validation-weighted ensemble' }), el('td', { class: 'num', text: v.ensemble_log_mae.toFixed(4) }), el('td', { class: 'num', text: '+7.1%' })),
          el('tr', { class: 'winner' }, el('td', { text: 'M2 tvl-only (shipped)' }), el('td', { class: 'num', text: v.tvl_only_log_mae.toFixed(4) }), el('td', { class: 'num', text: '+11.4%' }))
        )
      ),
      el('p', { class: 'sub', text: 'Why TVL alone: growth and age were tested and dropped. The full regression fits a growth coefficient of ' + v.growth_coefficient + ' (negative — fast 7-day growth predicts a lower multiple out-of-sample), and adding either feature hurts the repeated grouped 5-fold CV (group = CoinGecko id, 4 repeats, n = 128 tokens, 2,560 predictions per candidate, all preprocessing fit inside each fold). A complex model that does not win out-of-sample is not shipped.' }),
      el('p', { class: 'sub', text: 'Census: ' + v.unique_gecko_id + ' unique CoinGecko ids, ' + v.duplicated_gecko_id + ' duplicates, ' + v.valid_comparables + ' valid comparables (market cap above zero with an id), ' + v.fitted_comparables + ' fitted after excluding Bridge, Canonical Bridge, CEX, Liquid Staking, Liquid Restaking and Restaked BTC.' }),
      el('div', { class: 'warn' }, el('b', { text: 'Read the interval, not just the point. ' }), 'Out-of-fold, 80% of true market caps fall between x' + v.interval_80_low + ' and x' + v.interval_80_high + ' of the base value, and the median absolute error is about 88%. The signal is weak by nature: an implied value is a model estimate, never a price and never a promised reward.')
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
    var steps = farmSteps(row);
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
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Risk and capital' }),
      el('div', { class: 'kv' },
        el('div', null, el('span', { text: 'Gas, whole plan' }), el('b', { text: '$' + row.farm_gas_usd })),
        el('div', null, el('span', { text: 'Capital at risk' }), el('b', { text: '$' + row.capital_at_risk_usd })),
        el('div', null, el('span', { text: 'Verdict' }), el('b', { text: row.verdict })),
        el('div', null, el('span', { text: 'Confidence' }), el('b', { text: row.confidence }))
      ),
      el('p', { class: 'sub', text: 'Gas and capital are separate: the gas is spent, the capital stays in the position and can be withdrawn. No campaign is verified for this protocol — do not farm it expecting a reward that was never promised.' })
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
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.verdict = 'all'; state.selected = null;
    readHash();
    render();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
