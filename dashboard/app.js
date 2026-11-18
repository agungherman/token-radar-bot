/* Token Radar dashboard — renders window.RADAR (written by main.ts as
   data.js) with no network and no framework. The board, the detail view,
   the filters and the model sandbox all run from that one dataset. */
(function () {
  'use strict';
  var DATA = window.RADAR || null;
  var root = document.getElementById('board');
  if (!DATA) {
    document.body.innerHTML = '<main style="padding:40px;font-family:system-ui">Token Radar needs data.js beside this page. Run main.ts first.</main>';
    return;
  }

  var rows = DATA.rows.slice();
  var live = DATA.live.slice();
  var model = DATA.model;

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function full(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(v) {
    if (v === null || v === undefined) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function ageLabel(days) {
    if (days === null || days === undefined) return 'unknown age';
    if (days < 30) return days + 'd old';
    if (days < 365) return Math.round(days / 30) + 'mo old';
    return (days / 365).toFixed(1) + 'y old';
  }

  /* The sandbox recomputes implied value from the row's own figures, using
     the dials' constants instead of the published ones. */
  var sandbox = { base: model.base_multiple, growth: model.growth_weight, maturity: model.maturity_floor };
  var sandboxOn = false;
  function recompute(r) {
    var growth = r.change_7d === null ? 0 : Math.min(model.growth_cap, Math.max(model.growth_floor, r.change_7d));
    var growthMult = 1 + (growth / 100) * sandbox.growth;
    var age = r.age_days === null ? model.unknown_age_days : r.age_days;
    var maturityMult = sandbox.maturity + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + Math.min(Math.max(r.chains.length - 1, 0), model.chain_cap) * model.chain_step;
    return Math.max(1, Math.round(r.tvl_usd * sandbox.base * growthMult * maturityMult * chainMult * r.category_multiplier));
  }
  function shownValue(r) { return sandboxOn ? recompute(r) : r.implied_value_usd; }

  var state = { q: '', cat: '', chain: '', sort: 'implied', watch: false, selected: null, shown: 60 };

  /* ---- header, stats and method ---- */
  var top = rows[0];
  var median = rows.length ? rows[Math.floor(rows.length / 2)].implied_value_usd : 0;
  var cats = {};
  rows.forEach(function (r) { cats[r.category || 'Uncategorised'] = (cats[r.category || 'Uncategorised'] || 0) + 1; });
  var topCat = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0] || '—';
  document.getElementById('meta').innerHTML =
    '<div><dt>Snapshot</dt><dd>' + esc(DATA.as_of) + '</dd></div>' +
    '<div><dt>Watchlist floor</dt><dd>' + money(DATA.floor_usd) + '</dd></div>' +
    '<div><dt>Board rows</dt><dd>' + DATA.board_size + '</dd></div>' +
    '<div><dt>Model</dt><dd>' + esc(DATA.model_version) + '</dd></div>';
  document.getElementById('asof').textContent = DATA.as_of;
  document.getElementById('stats').innerHTML =
    '<div class="stat"><b>' + DATA.watchlist_size + '</b><span>protocols on the watchlist (TVL at or above ' + money(DATA.floor_usd) + ', no token recorded)</span></div>' +
    '<div class="stat"><b>' + DATA.early_size + '</b><span>early rows below the floor — the radar looking ahead</span></div>' +
    '<div class="stat"><b>' + money(median) + '</b><span>median implied value across the board</span></div>' +
    '<div class="stat"><b>' + esc(topCat) + '</b><span>most common category on the board (' + (cats[topCat] || 0) + ' rows)</span></div>' +
    '<div class="stat"><b>' + DATA.live_size + '</b><span>protocols already trading, shown separately</span></div>';
  document.getElementById('method').textContent =
    'Implied value = TVL × ' + model.base_multiple + ' (base), × a growth factor from the 7-day TVL change ' +
    '(clamped ' + model.growth_floor + '% to +' + model.growth_cap + '%, weight ' + model.growth_weight + '), ' +
    '× a maturity factor (' + model.maturity_floor + ' + up to ' + model.maturity_range + ' over ' + model.maturity_days + ' days), ' +
    '× a chain-breadth factor (+' + (model.chain_step * 100) + '% per extra chain, up to ' + model.chain_cap + '), ' +
    '× a category factor (1.00–1.10). The whole watchlist is covered; early rows are pre-token protocols below the floor, ranked by the same rule. ' +
    'A protocol is pre-token when the snapshot records no market cap, no CoinGecko id and no symbol for it — and it is left out when it is a wrapped, staked or bridged product, a versioned pool, or an exchange venue.';

  /* ---- model sandbox dials ---- */
  var dials = [
    { key: 'base', label: 'Base multiple (TVL × …)', min: 0.05, max: 0.5, step: 0.01, fmt: function (v) { return v.toFixed(2); } },
    { key: 'growth', label: 'Growth weight', min: 0, max: 1.5, step: 0.05, fmt: function (v) { return v.toFixed(2); } },
    { key: 'maturity', label: 'Maturity floor', min: 0.3, max: 1, step: 0.05, fmt: function (v) { return v.toFixed(2); } },
  ];
  document.getElementById('dials').innerHTML = dials.map(function (d, i) {
    return '<div class="dial"><label for="dial-' + i + '">' + d.label + ' — <output id="out-' + i + '">' + d.fmt(sandbox[d.key]) + '</output></label>' +
      '<input type="range" id="dial-' + i + '" min="' + d.min + '" max="' + d.max + '" step="' + d.step + '" value="' + sandbox[d.key] + '"></div>';
  }).join('');
  dials.forEach(function (d, i) {
    document.getElementById('dial-' + i).addEventListener('input', function (e) {
      sandbox[d.key] = parseFloat(e.target.value);
      document.getElementById('out-' + i).textContent = d.fmt(sandbox[d.key]);
      sandboxOn = sandbox.base !== model.base_multiple || sandbox.growth !== model.growth_weight || sandbox.maturity !== model.maturity_floor;
      document.getElementById('sandbox-note').textContent = sandboxOn
        ? 'Sandbox on: the board below is re-ranked with your dials. The published board keeps model ' + DATA.model_version + '.'
        : 'Sandbox off: the board shows the published model.';
      render();
    });
  });

  /* ---- filters ---- */
  var catSel = document.getElementById('cat');
  var chainSel = document.getElementById('chain');
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c + ' (' + cats[c] + ')'; catSel.appendChild(o);
  });
  var chainCounts = {};
  rows.forEach(function (r) { r.chains.forEach(function (ch) { chainCounts[ch] = (chainCounts[ch] || 0) + 1; }); });
  Object.keys(chainCounts).sort().forEach(function (ch) {
    var o = document.createElement('option'); o.value = ch; o.textContent = ch + ' (' + chainCounts[ch] + ')'; chainSel.appendChild(o);
  });
  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value.trim().toLowerCase(); state.shown = 60; render(); });
  catSel.addEventListener('change', function (e) { state.cat = e.target.value; state.shown = 60; render(); });
  chainSel.addEventListener('change', function (e) { state.chain = e.target.value; state.shown = 60; render(); });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  document.getElementById('watch').addEventListener('change', function (e) { state.watch = e.target.checked; state.shown = 60; render(); });

  function filtered() {
    var list = rows.filter(function (r) {
      if (state.watch && r.tags.indexOf('watchlist') < 0) return false;
      if (state.cat && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.q && (r.name + ' ' + r.slug).toLowerCase().indexOf(state.q) < 0) return false;
      return true;
    });
    var by = {
      implied: function (a, b) { return shownValue(b) - shownValue(a) || a.slug.localeCompare(b.slug); },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (a.age_days === null ? 1e9 : a.age_days) - (b.age_days === null ? 1e9 : b.age_days); },
      name: function (a, b) { return a.name.localeCompare(b.name); },
    }[state.sort];
    return list.sort(by);
  }

  /* ---- board table ---- */
  function renderBoard(list) {
    var body = document.getElementById('rows');
    var page = list.slice(0, state.shown);
    if (page.length === 0) {
      body.innerHTML = '<tr><td colspan="7"><div class="empty">Nothing matches those filters. Clear the search or widen the category.</div></td></tr>';
    } else {
      body.innerHTML = page.map(function (r) {
        var chg = r.change_7d === null ? '<span>—</span>' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
        var tags = r.tags.map(function (t) { return '<span class="tag' + (t === 'watchlist' ? ' watch' : '') + '">' + esc(t) + '</span>'; }).join('');
        return '<tr data-slug="' + esc(r.slug) + '" class="' + (state.selected === r.slug ? 'sel' : '') + '">' +
          '<td>' + r.rank + '</td>' +
          '<td><div class="name">' + esc(r.name) + '</div><div class="sub">' + esc(r.slug) + ' · ' + esc(ageLabel(r.age_days)) + '<br>' + tags + '</div></td>' +
          '<td>' + esc(r.category || '—') + '</td>' +
          '<td>' + esc(r.chains.slice(0, 3).join(', ') || '—') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
          '<td class="num">' + money(r.tvl_usd) + '</td>' +
          '<td class="num">' + chg + '</td>' +
          '<td class="num"><strong>' + money(shownValue(r)) + '</strong></td></tr>';
      }).join('');
    }
    document.getElementById('count').textContent = 'Showing ' + page.length + ' of ' + list.length + ' matching rows' +
      (sandboxOn ? ' — re-ranked by the sandbox' : ' — ranked by the published model') + '.';
    document.getElementById('more').innerHTML = list.length > state.shown
      ? '<button id="more-btn" type="button">Show 60 more</button> ' + (list.length - state.shown) + ' rows still hidden.'
      : list.length + ' rows in total.';
    var btn = document.getElementById('more-btn');
    if (btn) btn.addEventListener('click', function () { state.shown += 60; render(); });
    body.querySelectorAll('tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { select(tr.getAttribute('data-slug')); });
    });
  }

  /* ---- detail view ---- */
  function barRow(label, value, scale) {
    var w = Math.max(4, Math.min(100, ((value - scale[0]) / (scale[1] - scale[0])) * 100));
    return '<div class="brow"><span>' + label + '</span><span class="bar"><i style="width:' + w.toFixed(0) + '%"></i></span><b>' + value.toFixed(2) + '×</b></div>';
  }
  function renderDetail(list) {
    var el = document.getElementById('detail');
    /* The detail follows the filter: when the selected row is filtered out,
       show the first row of the filtered board instead. */
    var visible = list || rows;
    var r = visible.find(function (x) { return x.slug === state.selected; }) || visible[0] || rows[0];
    if (!r) { el.innerHTML = '<h2>No protocol selected</h2>'; return; }
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    el.innerHTML =
      '<p class="slug">Rank #' + r.rank + ' · ' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorised') + '</p>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<p><strong>' + money(shownValue(r)) + '</strong> implied value &nbsp;·&nbsp; ' + money(r.tvl_usd) + ' TVL &nbsp;·&nbsp; ' +
      (r.change_7d === null ? '7d change not reported' : pct(r.change_7d) + ' over 7 days') + ' &nbsp;·&nbsp; ' + esc(ageLabel(r.age_days)) + '</p>' +
      '<p class="why">' + esc(r.why) + '</p>' +
      '<div class="breakdown"><h3>Where the value comes from</h3>' +
      barRow('Growth', r.growth_multiplier, [0.7, 1.9]) +
      barRow('Maturity', r.maturity_multiplier, [0.7, 1.0]) +
      barRow('Chain breadth', r.chain_multiplier, [1.0, 1.12]) +
      barRow('Category', r.category_multiplier, [1.0, 1.1]) +
      '<p class="hint">Base: ' + money(r.tvl_usd * model.base_multiple) + ' (TVL × ' + model.base_multiple + '). Chains: ' + esc(r.chains.join(', ') || 'none listed') + '.</p></div>' +
      '<h3>How to farm it — 7 steps</h3><ol class="steps">' + steps + '</ol>' +
      '<p class="note">No token is recorded for this protocol, which is not proof it will issue one. Farm it because the position itself is worth holding, not because a launch is promised.</p>';
  }
  function select(slug) {
    state.selected = slug;
    render();
    var el = document.getElementById('detail');
    if (el && window.innerWidth < 900) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---- live view + render + hash routing ---- */
  function renderLive() {
    document.getElementById('live-rows').innerHTML = live.map(function (r) {
      var chg = r.change_7d === null ? '—' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
      return '<tr><td><div class="name">' + esc(r.name) + '</div><div class="sub">' + esc(r.slug) + '</div></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + (r.mcap_usd === null ? '—' : money(r.mcap_usd)) + '</td>' +
        '<td class="num">' + chg + '</td></tr>';
    }).join('');
  }
  function render() {
    var list = filtered();
    renderBoard(list);
    renderDetail(list);
  }
  renderLive();

  /* Deep links for the screenshots and for sharing a view:
     #/detail/<slug> opens one protocol; #/filtered/<category> filters. */
  var hash = window.location.hash || '';
  var m = hash.match(/^#\/detail\/([A-Za-z0-9._-]+)$/);
  var f = hash.match(/^#\/filtered\/(.+)$/);
  if (m) state.selected = m[1];
  if (f) {
    var cat = decodeURIComponent(f[1]);
    if (catSel.querySelector('option[value="' + cat.replace(/"/g, '') + '"]')) { state.cat = cat; catSel.value = cat; }
  }
  render();
  /* A deep link lands on the view it names, not the top of the page. */
  if (m || f) {
    var target = document.querySelector('.layout');
    if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 8);
  }
})();
