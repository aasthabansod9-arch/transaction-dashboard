/* ================= chart toolkit + growth charts ================= */
const TIP = document.getElementById('tip');
function tipShow(ev, title, rows, note) {
  TIP.replaceChildren();
  const t = document.createElement('div'); t.className = 'tt'; t.textContent = title; TIP.appendChild(t);
  (rows || []).forEach(r => {
    if (!r) return;
    const d = document.createElement('div'); d.className = 'tr';
    const a = document.createElement('span');
    if (r.c) { const k = document.createElement('i'); k.className = 'k'; k.style.background = r.c; a.appendChild(k); }
    a.appendChild(document.createTextNode(r.k));
    const b = document.createElement('b'); b.textContent = r.v;
    d.appendChild(a); d.appendChild(b); TIP.appendChild(d);
  });
  if (note) { const n = document.createElement('div'); n.className = 'tn'; n.textContent = note; TIP.appendChild(n); }
  TIP.style.opacity = 1;
  const w = TIP.offsetWidth, h = TIP.offsetHeight, x = ev.clientX, y = ev.clientY;
  let left = x + 14, top = y + 14;
  if (left + w > innerWidth - 8) left = x - w - 14;
  if (top + h > innerHeight - 8) top = y - h - 14;
  TIP.style.left = Math.max(8, left) + 'px'; TIP.style.top = Math.max(8, top) + 'px';
}
const tipHide = () => { TIP.style.opacity = 0; };
const pctTxt = (a, b) => b ? fmtPctS((a - b) / Math.abs(b)) : '–';
const CAT = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function mkSvg(el, W, H, label) {
  el.replaceChildren();
  return d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label || '');
}
function bodyW(el) { return Math.max(280, Math.floor(el.clientWidth || 600)); }
function toggleFilter(key, k, only) {
  const set = S.F[key];
  if (only) { if (set.size === 1 && set.has(k)) set.clear(); else { set.clear(); set.add(k); } }
  else if (set.has(k)) set.delete(k); else set.add(k);
  refresh();
}
function medianHist(h, off) {
  let tot = 0; for (let i = 0; i < NB; i++) tot += h[off + i];
  if (!tot) return 0; let c = 0;
  for (let i = 0; i < NB; i++) { const n = h[off + i]; if (c + n >= tot / 2) { const f = n ? (tot / 2 - c) / n : 0; return Math.pow(10, (i + f) / 100); } c += n; }
  return 0;
}
/* a row set for one categorical dimension (cross-filter semantics: own filter ignored so every bar stays visible) */
function catRows(ctx, key) {
  const j = DBY[key].j, A = ctx.R.cross[j], P = ctx.C ? ctx.C.cross[j] : null;
  return DBY[key].labels.map((label, k) => {
    const o = k * NM, r = { k, key, label, cnt: A[o], val: A[o + 1], cred: A[o + 2], fN: A[o + 3], fV: A[o + 4], frN: A[o + 5], frV: A[o + 6], ln: A[o + 7], emi: A[o + 8], st: [A[o + 9], A[o + 10], A[o + 11], A[o + 12]] };
    if (P) r.p = { cnt: P[o], val: P[o + 1], fN: P[o + 3], frN: P[o + 5], emi: P[o + 8] };
    return r;
  });
}
const mval = (r, m) => m === 'val' ? r.val : m === 'cnt' ? r.cnt : safeDiv(r.val, r.cnt) / 100;
const mvalX = (x, m) => m === 'val' ? x.val : m === 'cnt' ? x.cnt : safeDiv(x.val, x.cnt) / 100;
function catTipRows(r, rows, ctx) {
  const tv = rows.reduce((t, x) => t + x.val, 0), tc = rows.reduce((t, x) => t + x.cnt, 0);
  const out = [{ k: 'Value', v: fmtCr(r.val) }, { k: 'Transactions', v: fmtN(r.cnt) }, { k: 'Avg ticket', v: fmtInr(safeDiv(r.val, r.cnt) / 100) },
    { k: 'Share of value', v: fmtPct(safeDiv(r.val, tv), 1) }, { k: 'Fraud rate', v: fmtPct(safeDiv(r.fN, r.cnt), 2) }, { k: 'Failed + reversed', v: fmtPct(safeDiv(r.frN, r.cnt), 1) }];
  if (r.p && r.p.val) out.push({ k: 'Value vs prior', v: pctTxt(r.val, r.p.val) }, { k: 'Count vs prior', v: pctTxt(r.cnt, r.p.cnt) });
  return out;
}

/* ---------- generic ranked bar table: label | main bar | extra columns ---------- */
function barTable(el, o) {
  const W = bodyW(el), rowH = o.rowH || 28, top = 24;
  const cols = W < 560 ? o.cols.slice(0, 1) : o.cols;
  const colW = W < 760 ? 116 : 138;
  const labelW = Math.min(158, Math.max(96, W * 0.22));
  const barX = labelW + 8, barW = Math.max(70, W - barX - cols.length * colW - 88);
  const H = top + o.rows.length * rowH + 4;
  const svg = mkSvg(el, W, H, o.aria);
  const mx = d3.max(o.rows, r => r.main) || 1, xs = d3.scaleLinear([0, mx], [0, barW]);
  svg.append('text').attr('x', barX).attr('y', 12).attr('class', 'tk').text(o.mainLabel);
  const cmax = cols.map(c => d3.max(o.rows, r => r.x[c.key]) || 1);
  cols.forEach((c, ci) => svg.append('text').attr('x', barX + barW + 88 + ci * colW).attr('y', 12).attr('class', 'tk').text(c.label));
  const sel = o.selSet && o.selSet.size > 0;
  o.rows.forEach((r, i) => {
    const y = top + i * rowH, g = svg.append('g').attr('class', 'clk' + (sel && !o.selSet.has(r.k) ? ' dim' : '')).attr('tabindex', 0).attr('role', 'button').attr('aria-label', r.label + ': ' + o.mainFmt(r.main));
    g.append('line').attr('class', 'grid').attr('x1', 0).attr('x2', W).attr('y1', y + rowH - 0.5).attr('y2', y + rowH - 0.5);
    g.append('text').attr('x', 0).attr('y', y + rowH / 2 + 4).attr('class', 'strong').style('font-weight', 500).text(r.label.length > 26 ? r.label.slice(0, 25) + '…' : r.label);
    const bw = Math.max(r.main > 0 ? 2 : 0, xs(r.main));
    g.append('rect').attr('x', barX).attr('y', y + 7).attr('width', bw).attr('height', rowH - 14).attr('rx', 3).style('fill', r.color || 'var(--s1)');
    g.append('text').attr('x', barX + bw + 6).attr('y', y + rowH / 2 + 4).attr('class', 'num').style('fill', 'var(--ink)').text((r.flagMain ? '▲ ' : '') + o.mainFmt(r.main));
    cols.forEach((c, ci) => {
      const v = r.x[c.key], x0 = barX + barW + 88 + ci * colW, tw = colW - 14 - 68, sc = d3.scaleLinear([0, c.max || cmax[ci]], [0, tw]);
      const flag = c.flag ? c.flag(v, r) : null, col = c.color ? c.color(v, r) : 'var(--muted)';
      g.append('text').attr('x', x0).attr('y', y + rowH / 2 + 4).attr('class', 'num').style('fill', flag ? 'var(--critText)' : 'var(--ink)').style('font-weight', flag ? 700 : 400).text((flag ? '▲ ' : '') + c.fmt(v));
      if (c.kind === 'dot') {
        g.append('line').attr('x1', x0 + 68).attr('x2', x0 + 68 + tw).attr('y1', y + rowH / 2).attr('y2', y + rowH / 2).style('stroke', 'var(--grid)').attr('stroke-width', 2);
        g.append('circle').attr('cx', x0 + 68 + Math.min(tw, sc(v))).attr('cy', y + rowH / 2).attr('r', 4.5).style('fill', col).style('stroke', 'var(--surface)').attr('stroke-width', 2);
      } else g.append('rect').attr('x', x0 + 68).attr('y', y + rowH / 2 - 3).attr('width', Math.max(1, sc(v))).attr('height', 6).attr('rx', 2).style('fill', col).style('opacity', 0.85);
    });
    g.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y).attr('width', W).attr('height', rowH);
    const show = ev => { const t = o.tip(r); tipShow(ev, t.title, t.rows, t.note); };
    g.on('pointermove', show).on('pointerleave', tipHide).on('focus', function () { const b = this.getBoundingClientRect(); show({ clientX: b.left + 40, clientY: b.top }); }).on('blur', tipHide)
      .on('click', () => { tipHide(); o.onClick && o.onClick(r.k); }).on('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); o.onClick && o.onClick(r.k); } });
  });
}

/* ---------- time axis helpers ---------- */
function timeAxis(svg, xs, bks, ml, plotW, y0, H) {
  const bw = plotW / bks.length, step = Math.max(1, Math.ceil(46 / bw));
  bks.forEach((b, i) => { if (i % step === 0) svg.append('text').attr('class', 'tk').attr('x', xs(i)).attr('y', H - 4).attr('text-anchor', 'middle').text(b.grain === 'day' ? b.short : b.short); });
}
function yGrid(svg, ys, ticks, ml, W, mr, fmt) {
  ticks.forEach(t => {
    svg.append('line').attr('class', 'grid').attr('x1', ml).attr('x2', W - mr).attr('y1', ys(t)).attr('y2', ys(t));
    svg.append('text').attr('class', 'tk').attr('x', ml - 8).attr('y', ys(t) + 4).attr('text-anchor', 'end').text(fmt(t));
  });
}
function drillBucket(b) {
  if (b.grain === 'day') return;
  S.a = b.s; S.b = b.e; if (S.grain !== 'auto') S.grain = { year: 'quarter', quarter: 'month', month: 'day' }[b.grain];
  syncPeriodUI(); refresh();
}

const CARDS = {};
/* ---------- 1. trend ---------- */
CARDS.trend = {
  q: 'Are we growing?', ctl: 'grain',
  render(el, ctx) {
    const { R, C, cr } = ctx, grain = curGrain(), m = S.metric;
    const bks = fillSeries(R, makeBuckets(S.a, S.b, grain)), cb = cr ? fillSeries(C, makeBuckets(cr[0], cr[1], grain)) : null;
    const sec = m === 'cnt' ? 'val' : 'cnt';
    const W = bodyW(el), ml = 66, mr = 86, H1 = 190, H2 = 100, gap = 26, H = H1 + gap + H2 + 24, pw = W - ml - mr, nb = bks.length;
    const xs = i => ml + (i + 0.5) * (pw / nb);
    const svg = mkSvg(el, W, H, 'Trend of ' + MET[m].name + ' by ' + grain);
    const panel = (key, y0, h, area, fmtf, labelTxt) => {
      const vals = bks.map(b => mvalX(b, key)), cv = cb ? cb.slice(0, nb).map(b => mvalX(b, key)) : [];
      const mx = Math.max(1e-9, d3.max(vals) || 0, d3.max(cv) || 0) * 1.08, ys = d3.scaleLinear([0, mx], [y0 + h, y0 + 6]);
      yGrid(svg, ys, d3.ticks(0, mx, 4), ml, W, mr, fmtf);
      svg.append('text').attr('class', 'tk').attr('x', ml).attr('y', y0 - 4).text(labelTxt);
      if (area) svg.append('path').attr('d', d3.area().x((d, i) => xs(i)).y0(y0 + h).y1(d => ys(d)).curve(d3.curveMonotoneX)(vals)).style('fill', 'var(--s1)').style('opacity', 0.16);
      if (cv.length) svg.append('path').attr('d', d3.line().x((d, i) => xs(i)).y(d => ys(d)).curve(d3.curveMonotoneX)(cv)).attr('fill', 'none').style('stroke', 'var(--muted)').attr('stroke-width', 1.6).attr('stroke-dasharray', '5 4');
      svg.append('path').attr('d', d3.line().x((d, i) => xs(i)).y(d => ys(d)).curve(d3.curveMonotoneX)(vals)).attr('fill', 'none').style('stroke', 'var(--s1)').attr('stroke-width', 2);
      const li = vals.length - 1;
      if (li >= 0) { svg.append('circle').attr('cx', xs(li)).attr('cy', ys(vals[li])).attr('r', 4).style('fill', 'var(--s1)').style('stroke', 'var(--surface)').attr('stroke-width', 2);
        svg.append('text').attr('class', 'strong num').attr('x', xs(li) + 8).attr('y', ys(vals[li]) + 4).text(fmtf(vals[li])); }
      return ys;
    };
    panel(m, 28, H1 - 28, true, MET[m].fmt, MET[m].name + ' per ' + grain);
    panel(sec, H1 + gap + 14, H2 - 14, false, MET[sec].fmt, MET[sec].name + ' per ' + grain);
    svg.append('line').attr('class', 'axis').attr('x1', ml).attr('x2', W - mr).attr('y1', H1 + gap + H2).attr('y2', H1 + gap + H2);
    timeAxis(svg, xs, bks, ml, pw, 0, H);
    const cross = svg.append('line').attr('y1', 16).attr('y2', H1 + gap + H2).style('stroke', 'var(--ink2)').attr('stroke-width', 1).style('opacity', 0);
    const tv = bks.reduce((t, b) => t + b.val, 0), tcn = bks.reduce((t, b) => t + b.cnt, 0);
    svg.append('rect').attr('class', 'hit clk').attr('x', ml).attr('y', 0).attr('width', pw).attr('height', H - 18)
      .on('pointermove', ev => {
        const r = ev.currentTarget.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(nb - 1, Math.floor((px - ml) / (pw / nb))));
        cross.attr('x1', xs(i)).attr('x2', xs(i)).style('opacity', 0.5);
        const b = bks[i], p = cb && cb[i];
        tipShow(ev, b.label + (b.partial ? ' (partial period)' : ''), [
          { k: 'Value', v: fmtCr(b.val), c: 'var(--s1)' }, { k: 'Transactions', v: fmtN(b.cnt) }, { k: 'Avg ticket', v: fmtInr(safeDiv(b.val, b.cnt) / 100) },
          { k: 'Share of period value', v: fmtPct(safeDiv(b.val, tv), 1) },
          p ? { k: 'Prior: ' + p.label, v: fmtCr(p.val), c: 'var(--muted)' } : null, p ? { k: 'Value vs prior', v: pctTxt(b.val, p.val) } : null, p ? { k: 'Count vs prior', v: pctTxt(b.cnt, p.cnt) } : null],
          grain === 'day' ? '' : 'Click to drill down');
      }).on('pointerleave', () => { cross.style('opacity', 0); tipHide(); })
      .on('click', ev => { const r = ev.currentTarget.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(nb - 1, Math.floor((px - ml) / (pw / nb)))); tipHide(); drillBucket(bks[i]); });
    const legend = [{ t: 'This period', c: 'var(--s1)', ln: 1 }];
    if (cb) legend.push({ t: 'Prior period (' + rangeText(cr[0], cr[1]) + ')', dash: 1 });
    // title
    let title;
    const cur = R.ov.val, pv = C ? C.ov.val : null;
    if (pv) { const d = safeDiv(cur - pv, pv); title = `Value is ${Math.abs(d) < 0.02 ? 'flat' : d > 0 ? 'up' : 'down'} ${fmtPctS(d)} at ${fmtCr(cur)} versus ${rangeText(cr[0], cr[1])}`; }
    else { const pk = bks.reduce((a, b) => b.val > a.val ? b : a, bks[0]); title = `${fmtCr(cur)} moved in ${bks.length} ${grain}${bks.length > 1 ? 's' : ''}; the high was ${pk.label}`; }
    return { title, legend, table: { cols: ['Period', 'Value (₹ Cr)', 'Transactions', 'Avg ticket (₹)', 'Prior value (₹ Cr)'], rows: bks.map((b, i) => [b.label + (b.partial ? ' *' : ''), (b.val / 1e9).toFixed(2), fmtN(b.cnt), fmtN(safeDiv(b.val, b.cnt) / 100), cb && cb[i] ? (cb[i].val / 1e9).toFixed(2) : '–']) }, note: bks.some(b => b.partial) ? '* partial period (data ends 1 Jan 2024).' : '' };
  }
};

/* ---------- 2. credits vs debits ---------- */
CARDS.flow = {
  q: 'Is money coming in or leaving?',
  render(el, ctx) {
    const { R, C, cr } = ctx, grain = curGrain();
    const bks = fillSeries(R, makeBuckets(S.a, S.b, grain)), cb = cr ? fillSeries(C, makeBuckets(cr[0], cr[1], grain)) : null;
    const W = bodyW(el), ml = 66, mr = 70, H = 300, pw = W - ml - mr, nb = bks.length, bw = pw / nb;
    const net = bks.map(b => b.cred - b.deb), mx = (d3.max(bks, b => Math.max(b.cred, b.deb)) || 1) * 1.06, mn = Math.min(0, d3.min(net) || 0) * 1.15;
    const ys = d3.scaleLinear([mn, mx], [H - 30, 14]), xs = i => ml + (i + 0.5) * bw;
    const svg = mkSvg(el, W, H, 'Credits, debits and net flow');
    yGrid(svg, ys, d3.ticks(mn, mx, 5), ml, W, mr, v => fmtCr(v).replace(' Cr', ''));
    svg.append('text').attr('class', 'tk').attr('x', ml - 8).attr('y', 8).attr('text-anchor', 'end').text('₹ Cr');
    const gw = Math.max(1.5, Math.min(18, bw * 0.38));
    bks.forEach((b, i) => {
      svg.append('rect').attr('x', xs(i) - gw - 1).attr('y', ys(b.cred)).attr('width', gw).attr('height', Math.max(0, ys(0) - ys(b.cred))).attr('rx', Math.min(3, gw / 2)).style('fill', 'var(--s1)');
      svg.append('rect').attr('x', xs(i) + 1).attr('y', ys(b.deb)).attr('width', gw).attr('height', Math.max(0, ys(0) - ys(b.deb))).attr('rx', Math.min(3, gw / 2)).style('fill', 'var(--s2)');
    });
    svg.append('line').attr('class', 'axis').attr('x1', ml).attr('x2', W - mr).attr('y1', ys(0)).attr('y2', ys(0));
    svg.append('path').attr('d', d3.line().x((d, i) => xs(i)).y(d => ys(d)).curve(d3.curveMonotoneX)(net)).attr('fill', 'none').style('stroke', 'var(--ink)').attr('stroke-width', 2);
    const li = nb - 1;
    svg.append('circle').attr('cx', xs(li)).attr('cy', ys(net[li])).attr('r', 4).style('fill', 'var(--ink)').style('stroke', 'var(--surface)').attr('stroke-width', 2);
    svg.append('text').attr('class', 'strong num').attr('x', xs(li) + 8).attr('y', ys(net[li]) + 4).text('Net ' + fmtCr(net[li]));
    timeAxis(svg, xs, bks, ml, pw, 0, H);
    const cross = svg.append('line').attr('y1', 10).attr('y2', H - 30).style('stroke', 'var(--ink2)').style('opacity', 0);
    svg.append('rect').attr('class', 'hit clk').attr('x', ml).attr('y', 0).attr('width', pw).attr('height', H - 20)
      .on('pointermove', ev => {
        const r = ev.currentTarget.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(nb - 1, Math.floor((px - ml) / bw)));
        cross.attr('x1', xs(i)).attr('x2', xs(i)).style('opacity', 0.5); const b = bks[i], p = cb && cb[i], tot = b.cred + b.deb;
        tipShow(ev, b.label + (b.partial ? ' (partial)' : ''), [{ k: 'Credits', v: fmtCr(b.cred), c: 'var(--s1)' }, { k: 'Debits', v: fmtCr(b.deb), c: 'var(--s2)' }, { k: 'Net flow', v: fmtCr(net[i], true), c: 'var(--ink)' }, { k: 'Credits share of value', v: fmtPct(safeDiv(b.cred, tot), 1) },
          p ? { k: 'Net flow prior', v: fmtCr(p.cred - p.deb, true) } : null, p ? { k: 'Credits vs prior', v: pctTxt(b.cred, p.cred) } : null, p ? { k: 'Debits vs prior', v: pctTxt(b.deb, p.deb) } : null], grain === 'day' ? '' : 'Click to drill down');
      }).on('pointerleave', () => { cross.style('opacity', 0); tipHide(); })
      .on('click', ev => { const r = ev.currentTarget.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(nb - 1, Math.floor((px - ml) / bw))); tipHide(); drillBucket(bks[i]); });
    const tc = R.ov.cred, td = R.ov.val - R.ov.cred, nt = tc - td;
    const title = nt < 0 ? `Debits exceed credits: net outflow of ${fmtCr(-nt)} (${fmtPct(safeDiv(-nt, R.ov.val), 0)} of value)` : `Credits exceed debits: net inflow of ${fmtCr(nt)}`;
    return { title, legend: [{ t: 'Credits', c: 'var(--s1)' }, { t: 'Debits', c: 'var(--s2)' }, { t: 'Net flow (credits − debits)', ln: 1, c: 'var(--ink)' }],
      table: { cols: ['Period', 'Credits (₹ Cr)', 'Debits (₹ Cr)', 'Net flow (₹ Cr)'], rows: bks.map((b, i) => [b.label, (b.cred / 1e9).toFixed(2), (b.deb / 1e9).toFixed(2), (net[i] / 1e9).toFixed(2)]) } };
  }
};

/* ---------- 3. value by transaction type ---------- */
CARDS.ttype = {
  q: 'Which payment rails matter?',
  render(el, ctx) {
    const m = S.metric, rows = catRows(ctx, 'ttype'), tot = rows.reduce((t, r) => t + r.val, 0), totc = rows.reduce((t, r) => t + r.cnt, 0);
    const list = rows.filter(r => r.cnt > 0).map(r => ({ ...r, main: mval(r, m), x: { share: m === 'cnt' ? safeDiv(r.cnt, totc) : safeDiv(r.val, tot), avg: safeDiv(r.val, r.cnt) / 100, fr: safeDiv(r.fN, r.cnt) } })).sort((a, b) => b.main - a.main);
    const cols = [{ key: 'share', label: m === 'cnt' ? 'Share of count' : 'Share of value', fmt: v => fmtPct(v, 1) }, { key: 'fr', label: 'Fraud rate', fmt: v => fmtPct(v, 2), kind: 'dot', color: (v) => v > 0.0135 ? 'var(--crit)' : 'var(--s1)', flag: (v) => v > 0.0135 }];
    barTable(el, { rows: list, cols, mainLabel: MET[m].name, mainFmt: MET[m].fmt, selSet: S.F.ttype, onClick: k => toggleFilter('ttype', k), aria: 'Value by transaction type', tip: r => ({ title: r.label, rows: catTipRows(r, rows, ctx) }) });
    const top = list[0], t3 = list.slice(0, 3).reduce((t, r) => t + (m === 'cnt' ? r.cnt / totc : r.val / tot), 0);
    return { title: top ? `${top.label} leads on ${MET[m].name.toLowerCase()}; the top three rails carry ${fmtPct(t3, 0)}` : 'No data', table: { cols: ['Type', 'Value (₹ Cr)', 'Transactions', 'Avg ticket (₹)', 'Fraud rate'], rows: list.map(r => [r.label, (r.val / 1e9).toFixed(2), fmtN(r.cnt), fmtN(safeDiv(r.val, r.cnt) / 100), fmtPct(safeDiv(r.fN, r.cnt), 2)]) }, note: 'Fraud rate marked ▲ when above 1.5× the bank average (0.9%).' };
  }
};

/* ---------- 4. mix over time ---------- */
let TT_RANK = null;
CARDS.mix = {
  q: 'Is digital shifting share?', ctl: 'mix',
  render(el, ctx) {
    const { R } = ctx, grain = curGrain() === 'day' && (S.b - S.a) > 60 ? 'day' : curGrain(), m = S.metric === 'cnt' ? 'cnt' : 'val';
    const bks = fillSeries(R, makeBuckets(S.a, S.b, grain)), nb = bks.length;
    let names, colors, series;
    const get = (b, t) => m === 'cnt' ? b.ttC[t] : b.ttV[t];
    if (S.mix === 'group') {
      names = GROUPS.map(g => g.split(' (')[0]); colors = [CAT[0], CAT[1], CAT[2], CAT[3]];
      series = names.map((n, g) => bks.map(b => { let s = 0; for (let t = 0; t < 10; t++) if (GROUP_OF[META.labels.ttype[t]] === g) s += get(b, t); return s; }));
    } else {
      const top = TT_RANK.slice(0, 7), rest = TT_RANK.slice(7);
      names = top.map(t => DBY.ttype.labels[t]).concat(['Other rails']); colors = CAT.slice(0, 7).concat(['var(--muted)']);
      series = top.map(t => bks.map(b => get(b, t))).concat([bks.map(b => rest.reduce((s, t) => s + get(b, t), 0))]);
    }
    const W = bodyW(el), ml = 44, mr = 130, H = 290, pw = W - ml - mr, xs = i => ml + (nb === 1 ? pw / 2 : i * pw / (nb - 1)), ys = d3.scaleLinear([0, 1], [H - 30, 10]);
    const svg = mkSvg(el, W, H, 'Share of ' + (m === 'cnt' ? 'count' : 'value') + ' by rail over time');
    const stack = d3.stack().keys(names.map((n, i) => i)).value((d, k) => series[k][d]).offset(d3.stackOffsetExpand)(d3.range(nb));
    [0, 0.25, 0.5, 0.75, 1].forEach(t => { svg.append('line').attr('class', 'grid').attr('x1', ml).attr('x2', W - mr).attr('y1', ys(t)).attr('y2', ys(t)); svg.append('text').attr('class', 'tk').attr('x', ml - 6).attr('y', ys(t) + 4).attr('text-anchor', 'end').text(Math.round(t * 100) + '%'); });
    const ar = d3.area().x((d, i) => xs(i)).y0(d => ys(d[0])).y1(d => ys(d[1])).curve(nb > 1 ? d3.curveMonotoneX : d3.curveLinear);
    stack.forEach((lay, k) => {
      const pts = nb === 1 ? lay.concat(lay) : lay;
      if (nb === 1) svg.append('rect').attr('x', ml).attr('width', pw).attr('y', ys(lay[0][1])).attr('height', ys(lay[0][0]) - ys(lay[0][1])).style('fill', colors[k]).style('stroke', 'var(--surface)').attr('stroke-width', 1.5);
      else svg.append('path').attr('d', ar(lay)).style('fill', colors[k]).style('stroke', 'var(--surface)').attr('stroke-width', 1.5);
      const last = lay[lay.length - 1], h = ys(last[0]) - ys(last[1]);
      if (h > 13) svg.append('text').attr('x', W - mr + 8).attr('y', (ys(last[0]) + ys(last[1])) / 2 + 4).attr('class', 'strong').style('font-weight', 500).text(names[k].length > 18 ? names[k].slice(0, 17) + '…' : names[k] + ' ' + Math.round((last[1] - last[0]) * 100) + '%');
    });
    timeAxis(svg, xs, bks, ml, pw, 0, H);
    const cross = svg.append('line').attr('y1', 10).attr('y2', H - 30).style('stroke', 'var(--ink)').style('opacity', 0);
    svg.append('rect').attr('class', 'hit').attr('x', ml).attr('y', 0).attr('width', pw).attr('height', H - 20)
      .on('pointermove', ev => {
        const r = ev.currentTarget.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(nb - 1, Math.round((px - ml) / (pw / Math.max(1, nb - 1)))));
        cross.attr('x1', xs(i)).attr('x2', xs(i)).style('opacity', 0.5); const tot = series.reduce((t, s) => t + s[i], 0);
        tipShow(ev, bks[i].label, names.map((n, k) => ({ k: n, v: fmtPct(safeDiv(series[k][i], tot), 1), c: colors[k] })), 'Share of ' + (m === 'cnt' ? 'transaction count' : 'transaction value'));
      }).on('pointerleave', () => { cross.style('opacity', 0); tipHide(); });
    const sh0 = names.map((n, k) => safeDiv(series[k][0], series.reduce((t, s) => t + s[0], 0))), sh1 = names.map((n, k) => safeDiv(series[k][nb - 1], series.reduce((t, s) => t + s[nb - 1], 0)));
    const dd = (sh1[0] - sh0[0]) * 100;
    const title = S.mix === 'group' ? (Math.abs(dd) < 1 ? `Rail mix is stable: instant digital holds ${fmtPct(sh1[0], 0)} of ${m === 'cnt' ? 'count' : 'value'}` : `Instant digital ${dd > 0 ? 'gained' : 'lost'} ${Math.abs(dd).toFixed(1)} points to ${fmtPct(sh1[0], 0)} of ${m === 'cnt' ? 'count' : 'value'}`) : `${names[0]} is the largest rail at ${fmtPct(sh1[0], 0)} of ${m === 'cnt' ? 'count' : 'value'}`;
    return { title, legend: names.map((n, k) => ({ t: n, c: colors[k] })), table: { cols: ['Period'].concat(names.map(n => n + ' share')), rows: bks.map((b, i) => { const tot = series.reduce((t, s) => t + s[i], 0); return [b.label].concat(series.map(s => fmtPct(safeDiv(s[i], tot), 1))); }) }, note: S.metric === 'avg' ? 'Average ticket has no share view; showing value share.' : '' };
  }
};

/* ---------- 5. channel ---------- */
CARDS.chan = {
  q: 'Where do we lose transactions?',
  render(el, ctx) {
    const m = S.metric, rows = catRows(ctx, 'chan'), list = rows.filter(r => r.cnt > 0).map(r => ({ ...r, main: mval(r, m), x: { fr: safeDiv(r.frN, r.cnt), pend: safeDiv(r.st[3], r.cnt) } })).sort((a, b) => b.main - a.main);
    const avgFr = safeDiv(rows.reduce((t, r) => t + r.frN, 0), rows.reduce((t, r) => t + r.cnt, 0));
    barTable(el, { rows: list, mainLabel: MET[m].name, mainFmt: MET[m].fmt, selSet: S.F.chan, onClick: k => toggleFilter('chan', k), aria: 'Value by channel with failure rate',
      cols: [{ key: 'fr', label: 'Failed + reversed', fmt: v => fmtPct(v, 1), kind: 'dot', max: Math.max(0.1, avgFr * 1.6), color: v => v > avgFr * 1.15 ? 'var(--crit)' : 'var(--s1)', flag: v => v > avgFr * 1.15 }, { key: 'pend', label: 'Pending', fmt: v => fmtPct(v, 1), kind: 'dot', max: Math.max(0.05, avgFr * 0.8) }],
      tip: r => ({ title: r.label, rows: catTipRows(r, rows, ctx).concat([{ k: 'Failed', v: fmtPct(safeDiv(r.st[1], r.cnt), 2) }, { k: 'Reversed', v: fmtPct(safeDiv(r.st[2], r.cnt), 2) }, { k: 'Pending', v: fmtPct(safeDiv(r.st[3], r.cnt), 2) }]) }) });
    const fr = list.map(r => r.x.fr), lo = Math.min(...fr), hi = Math.max(...fr), hot = list.find(r => r.x.fr === hi);
    const title = !list.length ? 'No data' : (hi - lo) < avgFr * 0.15 ? `Every channel loses about ${fmtPct(avgFr, 1)} of transactions; none stands out` : `${hot.label} is the weak channel at ${fmtPct(hi, 1)} failed or reversed`;
    return { title, table: { cols: ['Channel', 'Value (₹ Cr)', 'Transactions', 'Failed + reversed', 'Pending'], rows: list.map(r => [r.label, (r.val / 1e9).toFixed(2), fmtN(r.cnt), fmtPct(r.x.fr, 2), fmtPct(r.x.pend, 2)]) }, note: 'Rate marked ▲ when 15% above the all-channel rate.' };
  }
};

/* ---------- 6. state ---------- */
CARDS.state = {
  q: 'Where is the business concentrated?',
  render(el, ctx) {
    const m = S.metric, rows = catRows(ctx, 'state'), tv = rows.reduce((t, r) => t + r.val, 0), tc = rows.reduce((t, r) => t + r.cnt, 0), base = safeDiv(rows.reduce((t, r) => t + r.fN, 0), tc);
    const list = rows.filter(r => r.cnt > 0).map(r => ({ ...r, main: mval(r, m), x: { cnt: r.cnt, val: r.val, fr: safeDiv(r.fN, r.cnt) } })).sort((a, b) => b.main - a.main);
    const second = m === 'cnt' ? { key: 'val', label: 'Value', fmt: v => fmtCr(v) } : { key: 'cnt', label: 'Transactions', fmt: v => fmtN(v) };
    barTable(el, { rows: list, mainLabel: MET[m].name, mainFmt: MET[m].fmt, selSet: S.F.state, onClick: k => toggleFilter('state', k), aria: 'Ranked states', rowH: 27,
      cols: [Object.assign({ kind: 'bar' }, second), { key: 'fr', label: 'Fraud rate', fmt: v => fmtPct(v, 2), kind: 'dot', max: Math.max(0.012, base * 1.5), color: v => v > base * 1.5 ? 'var(--crit)' : 'var(--s1)', flag: v => v > base * 1.5 }],
      tip: r => ({ title: r.label, rows: catTipRows(r, rows, ctx) }) });
    const t3 = list.slice(0, 3), sh = t3.reduce((t, r) => t + (m === 'cnt' ? r.cnt / tc : r.val / tv), 0);
    return { title: list.length ? `${t3.map(r => r.label).join(', ')} carry ${fmtPct(sh, 0)} of ${m === 'cnt' ? 'transactions' : 'value'}` : 'No data', table: { cols: ['State', 'Value (₹ Cr)', 'Transactions', 'Avg ticket (₹)', 'Fraud rate'], rows: list.map(r => [r.label, (r.val / 1e9).toFixed(2), fmtN(r.cnt), fmtN(safeDiv(r.val, r.cnt) / 100), fmtPct(safeDiv(r.fN, r.cnt), 2)]) }, note: 'A ranked bar stands in for a map: ten states, exact values, sortable at a glance.' };
  }
};

/* ---------- 7. account type ---------- */
CARDS.acct = {
  q: 'Which products drive volume?',
  render(el, ctx) {
    const m = S.metric, rows = catRows(ctx, 'acct'), tv = rows.reduce((t, r) => t + r.val, 0);
    const list = rows.filter(r => r.cnt > 0).map(r => ({ ...r, main: mval(r, m), med: medianHist(ctx.R.histAcct, r.k * NB), x: {} })).sort((a, b) => b.main - a.main);
    list.forEach(r => { r.x = { avg: safeDiv(r.val, r.cnt) / 100, med: r.med }; });
    barTable(el, { rows: list, mainLabel: MET[m].name, mainFmt: MET[m].fmt, selSet: S.F.acct, onClick: k => toggleFilter('acct', k), aria: 'Account types',
      cols: [{ key: 'avg', label: 'Average ticket', fmt: v => fmtInr(v), kind: 'bar', max: d3.max(list, r => r.x.avg) }, { key: 'med', label: 'Median ticket ≈', fmt: v => fmtInr(v), kind: 'dot', max: d3.max(list, r => r.x.avg), color: () => 'var(--s2)' }],
      tip: r => ({ title: r.label, rows: catTipRows(r, rows, ctx).concat([{ k: 'Median ticket ≈', v: fmtInr(r.med) }]) }) });
    const top = list[0], mm = list.map(r => r.med);
    return { title: top ? `${top.label} drives ${fmtPct(safeDiv(top.val, tv), 0)} of value; the median ticket is only ${fmtInr(d3.median(mm))}, the average ${fmtInr(safeDiv(ctx.R.ov.val, ctx.R.ov.cnt) / 100)}` : 'No data',
      table: { cols: ['Account type', 'Value (₹ Cr)', 'Transactions', 'Average ticket (₹)', 'Median ticket ≈ (₹)'], rows: list.map(r => [r.label, (r.val / 1e9).toFixed(2), fmtN(r.cnt), fmtN(r.x.avg), fmtN(r.med)]) }, note: 'A few very large payments pull the average far above the median. Median is read from a log-scale histogram (within 2.5%).' };
  }
};

/* ---------- 8. merchant treemap ---------- */
CARDS.tree = {
  q: 'Where do customers spend and receive?',
  render(el, ctx) {
    const m = S.metric, rows = catRows(ctx, 'merch').filter(r => r.cnt > 0), W = bodyW(el), H = Math.round(Math.max(300, W * 0.52));
    if (!rows.length) { el.textContent = 'No transactions match the current filters.'; return { title: 'No data for this selection' }; }
    const sizeOf = r => m === 'val' ? r.val : r.cnt, tv = rows.reduce((t, r) => t + r.val, 0), tcr = rows.reduce((t, r) => t + r.cred, 0), mid = safeDiv(tcr, tv);
    const svg = mkSvg(el, W, H + 30, 'Treemap of merchant categories');
    const root = d3.hierarchy({ children: rows.map(r => ({ r })) }).sum(d => d.r ? sizeOf(d.r) : 0).sort((a, b) => b.value - a.value);
    d3.treemap().size([W, H]).paddingInner(2).round(true)(root);
    const spread = Math.max(0.02, d3.max(rows, r => Math.abs(safeDiv(r.cred, r.val) - mid)) || 0.02);
    const cIn = cssv('--s1'), cOut = cssv('--s2'), cMid = cssv('--mid');
    const col = x => { const t = Math.max(-1, Math.min(1, (x - mid) / spread)); return t >= 0 ? d3.interpolateRgb(cMid, cIn)(t) : d3.interpolateRgb(cMid, cOut)(-t); };
    const sel = S.F.merch.size > 0;
    root.leaves().forEach(n => {
      const r = n.data.r, w = n.x1 - n.x0, h = n.y1 - n.y0, cs = safeDiv(r.cred, r.val), fill = col(cs), lum = d3.hsl(fill).l;
      const g = svg.append('g').attr('class', 'clk' + (sel && !S.F.merch.has(r.k) ? ' dim' : '')).attr('tabindex', 0).attr('role', 'button').attr('aria-label', r.label);
      g.append('rect').attr('x', n.x0).attr('y', n.y0).attr('width', w).attr('height', h).attr('rx', 3).style('fill', fill).style('stroke', S.F.merch.has(r.k) ? 'var(--ink)' : 'var(--surface)').attr('stroke-width', S.F.merch.has(r.k) ? 2.5 : 1);
      const tc = lum > 0.55 ? '#0b0b0b' : '#ffffff';
      if (w > 64 && h > 34) { g.append('text').attr('x', n.x0 + 7).attr('y', n.y0 + 17).style('fill', tc).style('font-weight', 600).style('font-size', '12px').text(r.label.length * 6.6 > w - 10 ? r.label.slice(0, Math.max(3, Math.floor((w - 12) / 6.6)) - 1) + '…' : r.label);
        g.append('text').attr('x', n.x0 + 7).attr('y', n.y0 + 32).style('fill', tc).style('font-size', '11px').text(MET[m].fmt(mval(r, m))); }
      g.append('rect').attr('class', 'hit').attr('x', n.x0).attr('y', n.y0).attr('width', w).attr('height', h);
      const show = ev => tipShow(ev, r.label, catTipRows(r, rows, ctx).concat([{ k: 'Credit (inflow) share', v: fmtPct(cs, 1) }]), 'Click to filter');
      g.on('pointermove', show).on('pointerleave', tipHide).on('click', () => { tipHide(); toggleFilter('merch', r.k); }).on('keydown', ev => { if (ev.key === 'Enter') toggleFilter('merch', r.k); });
    });
    // legend gradient
    const gid = 'tg' + Math.random().toString(36).slice(2, 7), df = svg.append('defs').append('linearGradient').attr('id', gid);
    [0, 0.5, 1].forEach(t => df.append('stop').attr('offset', t * 100 + '%').attr('stop-color', col(mid + (t - 0.5) * 2 * spread)));
    const lw = Math.min(260, W - 20), lx = (W - lw) / 2;
    svg.append('rect').attr('x', lx).attr('y', H + 8).attr('width', lw).attr('height', 8).attr('rx', 4).attr('fill', `url(#${gid})`);
    svg.append('text').attr('class', 'tk').attr('x', lx).attr('y', H + 28).text('More outflow (spending)');
    svg.append('text').attr('class', 'tk').attr('x', lx + lw).attr('y', H + 28).attr('text-anchor', 'end').text('More inflow (receipts)');
    const sorted = rows.slice().sort((a, b) => sizeOf(b) - sizeOf(a)), sh = sorted.slice(0, 3).reduce((t, r) => t + sizeOf(r), 0) / (m === 'val' ? tv : rows.reduce((t, r) => t + r.cnt, 0));
    const inflow = rows.slice().sort((a, b) => safeDiv(b.cred, b.val) - safeDiv(a.cred, a.val))[0];
    return { title: sorted.length ? `${sorted.slice(0, 3).map(r => r.label).join(', ')} take ${fmtPct(sh, 0)} of ${m === 'val' ? 'value' : 'transactions'}; ${inflow.label} is the most inflow-heavy` : 'No data', table: { cols: ['Category', 'Value (₹ Cr)', 'Transactions', 'Inflow share'], rows: sorted.map(r => [r.label, (r.val / 1e9).toFixed(2), fmtN(r.cnt), fmtPct(safeDiv(r.cred, r.val), 1)]) }, note: 'Area follows the metric (count when Avg ticket is selected). Colour shows inflow versus outflow against the bank-wide balance of ' + fmtPct(mid, 0) + ' credits.' };
  }
};
