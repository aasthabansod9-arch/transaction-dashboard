/* ================= UI: controls, cards, insights, boot ================= */
let LAST = null;
const SLICER_KEYS = ['state', 'acct', 'ttype', 'chan', 'merch', 'loan', 'kyc', 'status', 'sb', 'ab', 'fraud'];

/* ---------- period controls ---------- */
const yearBounds = y => [dateToDay(y, 0, 1), y === 2024 ? STUB_DAY : dateToDay(y + 1, 0, 1) - 1];
function currentYear() {
  if (S.a === 0 && S.b === LAST_FULL_DAY) return 'all';
  const ya = dYear[S.a], yb = dYear[S.b]; return ya === yb ? ya : null;
}
function buildPeriod() {
  const ys = $('#yearSeg'); ys.replaceChildren();
  [['all', 'All 2019–23'], [2019, '2019'], [2020, '2020'], [2021, '2021'], [2022, '2022'], [2023, '2023'], [2024, '2024 (1 day)']].forEach(([v, t]) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.textContent = t;
    b.addEventListener('click', () => { if (v === 'all') { S.a = 0; S.b = LAST_FULL_DAY; } else [S.a, S.b] = yearBounds(v); S.grain = 'auto'; syncPeriodUI(); refresh(); });
    ys.appendChild(b);
  });
  const qs = $('#qSeg'); qs.replaceChildren();
  [1, 2, 3, 4].forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = q; b.textContent = 'Q' + q;
    b.addEventListener('click', () => { const y = currentYear(); if (typeof y !== 'number') return; const on = b.getAttribute('aria-pressed') === 'true';
      if (on) [S.a, S.b] = yearBounds(y); else { S.a = dateToDay(y, (q - 1) * 3, 1); S.b = Math.min(dateToDay(y, q * 3, 1) - 1, STUB_DAY); } syncPeriodUI(); refresh(); }); qs.appendChild(b); });
  const ms = $('#monthSel'); ms.replaceChildren(new Option('All months', ''));
  MON.forEach((m, i) => ms.appendChild(new Option(m, i)));
  ms.addEventListener('change', () => { const y = currentYear(); if (typeof y !== 'number') { ms.value = ''; return; }
    if (ms.value === '') [S.a, S.b] = yearBounds(y); else { const m = +ms.value; S.a = dateToDay(y, m, 1); S.b = Math.min(dateToDay(y, m + 1, 1) - 1, STUB_DAY); } syncPeriodUI(); refresh(); });
  const df = $('#dFrom'), dt = $('#dTo');
  const onDate = () => { if (!df.value || !dt.value) return; let a = isoToDay(df.value), b = isoToDay(dt.value); if (a > b) [a, b] = [b, a]; S.a = Math.max(0, a); S.b = Math.min(STUB_DAY, b); S.grain = 'auto'; syncPeriodUI(); refresh(); };
  df.addEventListener('change', onDate); dt.addEventListener('change', onDate);
  $$('#cmpSeg button').forEach(b => b.addEventListener('click', () => { S.cmp = b.dataset.v; $$('#cmpSeg button').forEach(x => x.setAttribute('aria-pressed', x === b)); refresh(); }));
  $$('#metSeg button').forEach(b => b.addEventListener('click', () => { S.metric = b.dataset.v; $$('#metSeg button').forEach(x => x.setAttribute('aria-pressed', x === b)); refresh(); }));
}
function syncPeriodUI() {
  const y = currentYear();
  $$('#yearSeg button').forEach(b => b.setAttribute('aria-pressed', String(y !== null && String(y) === b.dataset.v)));
  const num = typeof y === 'number', ya = num ? y : 0;
  let qOn = 0, mOn = '';
  if (num) {
    for (let q = 1; q <= 4; q++) if (S.a === dateToDay(ya, (q - 1) * 3, 1) && S.b === Math.min(dateToDay(ya, q * 3, 1) - 1, STUB_DAY)) qOn = q;
    for (let m = 0; m < 12; m++) if (S.a === dateToDay(ya, m, 1) && S.b === Math.min(dateToDay(ya, m + 1, 1) - 1, STUB_DAY)) mOn = String(m);
  }
  $$('#qSeg button').forEach(b => { b.setAttribute('aria-pressed', String(+b.dataset.v === qOn)); b.disabled = !num || ya === 2024; });
  $('#monthSel').value = mOn; $('#monthSel').disabled = !num || ya === 2024;
  $('#dFrom').value = iso(S.a); $('#dTo').value = iso(S.b);
}
function zoomOut() {
  const y = currentYear();
  if (y === 'all') return;
  if (typeof y === 'number') { const isYear = S.a === yearBounds(y)[0] && S.b === yearBounds(y)[1]; if (isYear) { S.a = 0; S.b = LAST_FULL_DAY; } else { const m = dayDate(S.a).getUTCMonth(), q = Math.floor(m / 3), span = S.b - S.a + 1;
      if (span <= 31) { S.a = dateToDay(y, q * 3, 1); S.b = Math.min(dateToDay(y, q * 3 + 3, 1) - 1, STUB_DAY); } else [S.a, S.b] = yearBounds(y); } }
  else { S.a = 0; S.b = LAST_FULL_DAY; }
  S.grain = 'auto'; syncPeriodUI(); refresh();
}

/* ---------- slicers ---------- */
function buildSlicers() {
  const host = $('#slicers'); host.replaceChildren();
  const l = document.createElement('span'); l.className = 'lbl'; l.textContent = 'Filter'; host.appendChild(l);
  SLICER_KEYS.forEach(key => {
    const d = DBY[key], wrap = document.createElement('div'); wrap.className = 'dd'; wrap.dataset.key = key;
    const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    const t = document.createElement('span'); t.textContent = d.title; const c = document.createElement('span'); c.className = 'cnt'; c.hidden = true; btn.append(t, c);
    const pop = document.createElement('div'); pop.className = 'pop'; pop.hidden = true;
    const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'clr'; clr.textContent = 'Clear ' + d.title.toLowerCase(); clr.addEventListener('click', () => { S.F[key].clear(); refresh(); }); pop.appendChild(clr);
    d.labels.forEach((lab, k) => { const lb = document.createElement('label'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.k = k; cb.id = `sl-${key}-${k}`;
      cb.addEventListener('change', () => { if (cb.checked) S.F[key].add(k); else S.F[key].delete(k); refresh(); }); lb.append(cb, document.createTextNode(lab)); pop.appendChild(lb); });
    btn.addEventListener('click', ev => { ev.stopPropagation(); const open = pop.hidden; $$('.dd .pop').forEach(p => { p.hidden = true; p.parentNode.firstChild.setAttribute('aria-expanded', 'false'); }); pop.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
    wrap.append(btn, pop); host.appendChild(wrap);
  });
  document.addEventListener('click', ev => { if (!ev.target.closest('.dd')) $$('.dd .pop').forEach(p => p.hidden = true); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') $$('.dd .pop').forEach(p => p.hidden = true); });
}
function syncSlicers() {
  $$('.dd').forEach(w => { const key = w.dataset.key, set = S.F[key], c = $('.cnt', w); c.hidden = !set.size; c.textContent = set.size;
    $$('input', w).forEach(cb => { cb.checked = set.has(+cb.dataset.k); }); });
  const chips = $('#chips'); chips.replaceChildren();
  DIMS.forEach(d => { const set = S.F[d.key]; if (!set.size) return;
    const ch = document.createElement('span'); ch.className = 'chip';
    const vals = Array.from(set).sort((a, b) => a - b).map(k => d.labels[k]);
    const t = document.createElement('span'); t.textContent = d.title + ': ' + (vals.length > 3 ? vals.length + ' selected' : vals.join(', '));
    const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + d.title + ' filter'); x.textContent = '×'; x.addEventListener('click', () => { set.clear(); refresh(); });
    ch.append(t, x); chips.appendChild(ch); });
}

/* ---------- cards ---------- */
function buildCards() {
  $$('[data-card]').forEach(card => {
    const id = card.dataset.card, def = CARDS[id];
    card.innerHTML = '<header><div><h3 class="at"></h3><p class="q"></p></div><div class="tools"></div></header><div class="ctl"></div><div class="legend" hidden></div><div class="body"></div><p class="note"></p>';
    $('.q', card).textContent = def.q;
    const tb = document.createElement('button'); tb.type = 'button'; tb.className = 'tbtn'; tb.textContent = 'Table'; tb.setAttribute('aria-pressed', 'false'); tb.addEventListener('click', () => { S.tables[id] = !S.tables[id]; tb.setAttribute('aria-pressed', String(!!S.tables[id])); if (LAST) renderCard(id, LAST); });
    $('.tools', card).appendChild(tb);
    const ctl = $('.ctl', card);
    if (def.ctl === 'grain') { const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Time grain');
      [['auto', 'Auto'], ['year', 'Year'], ['quarter', 'Quarter'], ['month', 'Month'], ['day', 'Day']].forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.textContent = t; b.addEventListener('click', () => { S.grain = v; refresh(); }); seg.appendChild(b); });
      const z = document.createElement('button'); z.type = 'button'; z.className = 'btn'; z.style.marginLeft = '8px'; z.style.padding = '4px 10px'; z.textContent = 'Zoom out'; z.addEventListener('click', zoomOut);
      ctl.style.display = 'flex'; ctl.style.alignItems = 'center'; ctl.append(seg, z); }
    else if (def.ctl === 'mix') { const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group');
      [['group', 'By rail group'], ['type', 'By transaction type']].forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.textContent = t; b.addEventListener('click', () => { S.mix = v; refresh(); }); seg.appendChild(b); }); ctl.appendChild(seg); }
  });
}
function renderCard(id, ctx) {
  const card = $(`[data-card="${id}"]`); if (!card) return;
  const body = $('.body', card), def = CARDS[id];
  let res;
  try { res = def.render(body, ctx); }
  catch (e) { console.error(id, e); body.textContent = 'This chart could not be drawn: ' + e.message; return; }
  $('.at', card).textContent = res.title || def.q;
  const lg = $('.legend', card); lg.replaceChildren(); lg.hidden = !res.legend;
  (res.legend || []).forEach(x => { const s = document.createElement('span'), i = document.createElement('i'); if (x.dash) i.className = 'dash'; else { if (x.ln) i.className = 'ln'; i.style.background = x.c; } s.append(i, document.createTextNode(x.t)); lg.appendChild(s); });
  $('.note', card).textContent = res.note || '';
  const tb = $('.tbtn', card); tb.hidden = !res.table;
  $$('.ctl .seg button', card).forEach(b => { const v = b.dataset.v; b.setAttribute('aria-pressed', String(def.ctl === 'grain' ? S.grain === v : S.mix === v)); });
  if (def.ctl === 'grain') { const g = curGrain(); $$('.ctl .seg button', card).forEach(b => { if (S.grain === 'auto' && b.dataset.v === g) b.title = 'Auto is showing ' + g; }); }
  if (res.table && S.tables[id]) {
    const wrap = document.createElement('div'); wrap.className = 'tblwrap'; const t = document.createElement('table'); t.className = 'tbl';
    const th = document.createElement('thead'), tr = document.createElement('tr'); res.table.cols.forEach((c, i) => { const h = document.createElement('th'); h.textContent = c; if (i) h.className = 'r'; tr.appendChild(h); }); th.appendChild(tr); t.appendChild(th);
    const tbd = document.createElement('tbody'); res.table.rows.forEach(r => { const tr2 = document.createElement('tr'); r.forEach((v, i) => { const td = document.createElement('td'); td.textContent = v; if (i) td.className = 'r'; tr2.appendChild(td); }); tbd.appendChild(tr2); });
    t.appendChild(tbd); wrap.appendChild(t); body.replaceChildren(wrap);
  }
}

/* ---------- insights ---------- */
function renderInsList(host, items, mode) {
  host.replaceChildren();
  if (!items.length) { const p = document.createElement('p'); p.className = 'note'; p.textContent = 'No transactions match the current filters.'; host.appendChild(p); return; }
  items.forEach(it => {
    const row = document.createElement('div'); row.className = 'insrow';
    const tag = document.createElement('span'); tag.className = 'tag ' + it.tag; tag.textContent = (it.tag === 'Risk' ? '▲ ' : it.tag === 'Watch' ? '● ' : '◆ ') + it.tag;
    const c = document.createElement('div'); c.style.minWidth = 0;
    const f = document.createElement('div'); f.className = 'f'; f.textContent = it.finding;
    const ev = document.createElement('div'); ev.className = 'ev'; ev.textContent = it.evidence;
    const imp = document.createElement('div'); imp.className = 'imp'; imp.textContent = it.imp ? `${fmtCr(it.imp)} ${it.weight != null && it.weight < 1 ? 'in scope' : 'at stake'} · ${it.impNote}` : '';
    c.append(f, ev);
    const mk = (cls, k, v) => { const d = document.createElement('div'); d.className = cls; const b = document.createElement('b'); b.textContent = k + ' '; d.append(b, document.createTextNode(v)); return d; };
    if (mode === 'full') c.append(mk('sw', 'So what:', it.sowhat), mk('ac', 'Action:', it.action), imp);
    else { const det = document.createElement('details'); const sm = document.createElement('summary'); sm.textContent = 'So what and action'; sm.style.cursor = 'pointer'; sm.style.color = 'var(--ink2)'; sm.style.fontSize = '13px'; det.append(sm, mk('sw', 'So what:', it.sowhat), mk('ac', 'Action:', it.action)); c.append(det, imp); }
    row.append(tag, c); host.appendChild(row);
  });
}
function renderHyp(hy) {
  const host = $('#hyp'); host.replaceChildren();
  hy.forEach(h => { const d = document.createElement('div'); d.className = 'hcard';
    const k = document.createElement('div'); k.className = 'lbl'; k.textContent = 'Hypothesis ' + h.id.toUpperCase();
    const t = document.createElement('div'); t.style.fontWeight = '600'; t.textContent = h.title;
    const v = document.createElement('div'); v.className = 'verdict ' + (h.verdict === 'ok' ? 'ok' : h.verdict === 'no' ? 'no' : 'na'); v.textContent = (h.verdict === 'ok' ? '✔ ' : h.verdict === 'no' ? '✖ ' : '… ') + h.label;
    const s = document.createElement('div'); s.className = 'hs'; s.textContent = h.head; const e = document.createElement('div'); e.className = 'he'; e.textContent = h.ev;
    d.append(k, t, v, s, e); host.appendChild(d); });
}

/* ---------- notes ---------- */
function renderNotes() {
  const n = $('#notes'); if (n.children.length) return;
  const defs = [
    ['Total transaction value', 'Sum of transaction_amount for every transaction in view (credits and debits, any status). Money moved, not revenue.'],
    ['Net flow', 'Credit value minus debit value. Negative means more money left than arrived.'],
    ['EMI book', 'Sum of emi_amount on transactions that carry a loan. EMI repeats on each transaction, so this measures instalment exposure through activity, not outstanding principal.'],
    ['Fraud rate and exposure', 'Fraud-flagged transactions ÷ all transactions; exposure is their combined value.'],
    ['Failed + reversed (revenue at risk)', 'Share of transactions with status Failed or Reversed, and their value. Pending is reported separately.'],
    ['Active customers', 'Distinct customer_id with at least one transaction in view.'],
    ['Average and median ticket', 'Average = value ÷ count. Median is read from a log-scale histogram and is accurate to about 2.5%.'],
    ['Comparison', '“Same period last year” shifts the selected dates back one calendar year; “previous period” uses the same number of days immediately before. Deltas show n/a when that period has no data.'],
    ['Tests', 'Chi-square for equality across groups, two-proportion z-test for pairs; a difference counts as real at p < 0.01.'],
    ['Number format', '₹ Cr for all totals (1 Cr = 1,00,00,000). Per-transaction amounts are in whole rupees with Indian digit grouping.']
  ];
  const notes = [
    `Source: ${fmtN(META.n)} transactions from 1 Jan 2019 to 1 Jan 2024, one row each. No duplicate IDs, no missing values other than loan_type “None”, which is a category meaning no loan.`,
    'There is no revenue, cost or profit column, so none is shown. Every money figure is a transaction-value proxy and is labelled as such.',
    '2024 holds 295 transactions from 1 January only. Default views stop at 31 Dec 2023, and any range that reaches 2024 is flagged as partial.',
    '19,422 transactions (3.5%) carry a loan flag and an EMI but loan_type “None”. They appear as “Loan, type not recorded” rather than being hidden.',
    'In this extract, a customer’s state, account type, KYC status, loan type and credit score change from one transaction to the next. Segment views therefore count transactions, and customer counts inside a segment can overlap.',
    'Transaction amounts are exact to the paisa. Account balances are held to the nearest rupee in this page (used only for thresholds and ratios).',
    'Amounts are heavily skewed (median about ₹2,036, mean about ₹29,900, maximum ₹1 Cr). Charts use ranked bars, amount buckets and totals so outliers do not flatten them.',
    'Rankings in Key insights use rupees at stake. Items where nothing is lost yet (concentration, volatility) are discounted so they do not crowd out risks.',
    'Every figure is computed in the page from the raw rows. A footer check confirms that category totals reconcile to the overall totals after each filter change.'
  ];
  const a = document.createElement('div'), b = document.createElement('div');
  a.innerHTML = '<h3>KPI definitions</h3>'; b.innerHTML = '<h3>Data notes</h3>';
  const dl = document.createElement('dl'); defs.forEach(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
  const ul = document.createElement('ul'); notes.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
  a.appendChild(dl); b.appendChild(ul); n.append(a, b);
}

/* ---------- integrity ---------- */
function selfCheck(R) {
  let ok = 0, bad = [];
  const chk = (c, m) => { if (c) ok++; else bad.push(m); };
  DIMS.forEach(d => { const A = R.full[d.j]; let n = 0, v = 0, f = 0;
    for (let k = 0; k < d.k; k++) { n += A[k * NM]; v += A[k * NM + 1]; f += A[k * NM + 3]; }
    chk(n === R.ov.cnt, d.key + ' count'); chk(v === R.ov.val, d.key + ' value'); chk(f === R.ov.fN, d.key + ' fraud'); });
  chk(R.dCnt.reduce((a, b) => a + b, 0) === R.ov.cnt, 'daily count'); chk(R.dVal.reduce((a, b) => a + b, 0) === R.ov.val, 'daily value');
  chk(R.heatC.reduce((a, b) => a + b, 0) >= R.ov.cnt, 'heat');
  return { ok, bad };
}

/* ---------- refresh pipeline ---------- */
let pending = false;
function refresh() { if (pending) return; pending = true; $$('.card').forEach(c => c.classList.add('busy')); requestAnimationFrame(() => setTimeout(doRefresh, 0)); }
function doRefresh() {
  pending = false;
  const t0 = performance.now();
  computeFail();
  const lo = lowerBound(S.a), hi = lowerBound(S.b + 1), R = aggregate(lo, hi, false), cr = cmpRange(S.a, S.b, S.cmp);
  const C = cr ? aggregate(lowerBound(cr[0]), lowerBound(cr[1] + 1), true) : null;
  LAST = { R, C, cr, ms: performance.now() - t0 };
  renderAll(LAST);
  $$('.card').forEach(c => c.classList.remove('busy'));
}
function renderAll(ctx) {
  const { R, C, cr } = ctx;
  syncPeriodUI(); syncSlicers();
  $$('#cmpSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S.cmp)));
  $$('#metSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S.metric)));
  const cr_ = $('#crumbs'); cr_.replaceChildren(); const b1 = document.createElement('b'); b1.textContent = rangeText(S.a, S.b); cr_.append('Viewing ', b1, ' · ' + (curGrain()) + ' grain · ');
  const zb = document.createElement('button'); zb.type = 'button'; zb.className = 'tbtn'; zb.textContent = 'Zoom out'; zb.addEventListener('click', zoomOut); cr_.appendChild(zb);
  const bn = $('#banner'); bn.replaceChildren(); const msgs = [];
  if (S.b >= STUB_DAY) msgs.push('This range includes 1 Jan 2024, a single day with 295 transactions. Treat it as a partial period.');
  if (!cr) msgs.push('No prior period exists in the data for this comparison, so changes show n/a. Pick a later period, or switch the comparison.');
  if (cr && cr[1] >= STUB_DAY) msgs.push('The comparison period includes the 1 Jan 2024 stub and is partial.');
  if (!R.ov.cnt) msgs.push('No transactions match these filters. Clear a filter to continue.');
  msgs.forEach(m => { const d = document.createElement('div'); d.className = 'banner'; d.style.marginTop = '4px'; d.textContent = m; bn.appendChild(d); });
  $('#sumSub').textContent = `${rangeText(S.a, S.b)} · ${fmtN(R.ov.cnt)} transactions in view`;
  renderKPIs(ctx); renderSnap(ctx);
  Object.keys(CARDS).forEach(id => renderCard(id, ctx));
  const ins = insights(R, C, cr), hy = ins.hyp || hypotheses(R);
  renderInsList($('#insTop'), ins.slice(0, 7), 'top'); renderInsList($('#insAll'), ins, 'full');
  if (R.ov.cnt) renderHyp(hy); else $('#hyp').replaceChildren();
  renderNotes();
  { const ns = $('#navState'); ns.replaceChildren(); const nf_ = DIMS.filter(d => S.F[d.key].size).length; const b = document.createElement('b'); b.textContent = rangeText(S.a, S.b); ns.append(b, document.createTextNode(` · ${fmtN(R.ov.cnt)} txns · ${nf_ ? nf_ + ' filter' + (nf_ > 1 ? 's' : '') + ' active' : 'no filters'}`));
    if (nf_) { const x = document.createElement('button'); x.type = 'button'; x.className = 'tbtn'; x.textContent = 'Clear filters'; x.addEventListener('click', () => { DIMS.forEach(d => S.F[d.key].clear()); refresh(); }); ns.appendChild(x); } }
  const chk = selfCheck(R), f = $('#foot'); f.replaceChildren();
  [`Data as of ${dayLabel(STUB_DAY)}`, `${fmtN(N)} rows analysed · ${fmtN(R.ov.cnt)} in view (${fmtPct(safeDiv(R.ov.cnt, N), 1)})`, chk.bad.length ? '⚠ Integrity check failed: ' + chk.bad.join(', ') : `✔ ${chk.ok} reconciliation checks passed`, `Refreshed in ${Math.round(ctx.ms)} ms`].forEach(t => { const s = document.createElement('span'); s.textContent = t; f.appendChild(s); });
}

/* ---------- theme, reset, nav ---------- */
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); $('#themeBtn').textContent = t === 'dark' ? 'Light mode' : 'Dark mode'; try { localStorage.setItem('dash-theme', t); } catch (e) { } if (LAST) renderAll(LAST); }
function initTheme() {
  let t = null; try { t = localStorage.getItem('dash-theme'); } catch (e) { }
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t); $('#themeBtn').textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
  $('#themeBtn').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
}
function resetAll() { DIMS.forEach(d => S.F[d.key].clear()); S.a = DEFAULT.a; S.b = DEFAULT.b; S.cmp = 'yoy'; S.metric = 'val'; S.grain = 'auto'; S.mix = 'group'; syncPeriodUI(); refresh(); }
function initNav() {
  const links = $$('#nav a'), ids = links.map(a => a.dataset.t);
  const on = () => { let cur = ids[0]; ids.forEach(id => { const e = document.getElementById(id); if (e && e.getBoundingClientRect().top < 160) cur = id; }); links.forEach(a => a.classList.toggle('on', a.dataset.t === cur)); };
  addEventListener('scroll', on, { passive: true }); on();
}

/* ---------- boot ---------- */
(async function boot() {
  initTheme();
  try {
    await loadData(); prepare(); initFilters();
    const tv = new Float64Array(10); for (let i = 0; i < N; i++) tv[D.ttype[i]] += D.amt[i];
    TT_RANK = Array.from({ length: 10 }, (_, i) => i).sort((a, b) => tv[b] - tv[a]);
    buildPeriod(); buildSlicers(); buildCards(); initNav();
    $('#resetBtn').addEventListener('click', resetAll);
    $('#loading').hidden = true; $('#main').hidden = false;
    syncPeriodUI(); doRefresh();
    let rt = null; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (LAST) renderAll(LAST); }, 150); }).observe($('#main'));
    window.__dash = { S, get last() { return LAST; }, D, DIMS, refresh, doRefresh, aggregate, computeFail, lowerBound };
  } catch (e) { console.error(e); $('#loading').textContent = 'The dashboard could not start: ' + e.message; }
})();
