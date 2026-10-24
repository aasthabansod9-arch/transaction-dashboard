/* ================= risk, lending and summary components ================= */
const baseFraud = R => safeDiv(R.ov.fN, R.ov.cnt);

/* ---------- 9. fraud by amount bucket ---------- */
CARDS.amt = {
  q: 'Where is fraud concentrated by ticket size?',
  render(el, ctx) {
    const rows = catRows(ctx, 'ab'), tF = rows.reduce((t, r) => t + r.fN, 0), tC = rows.reduce((t, r) => t + r.cnt, 0), tFV = rows.reduce((t, r) => t + r.fV, 0), base = safeDiv(tF, tC);
    const W = bodyW(el), H = 290, ml = 40, mr = 10, pw = W - ml - mr, bw = pw / 5, rates = rows.map(r => safeDiv(r.fN, r.cnt)), mx = Math.max(0.005, ...rates) * 1.25;
    const ys = d3.scaleLinear([0, mx], [H - 50, 24]), svg = mkSvg(el, W, H, 'Fraud rate by amount bucket');
    yGrid(svg, ys, d3.ticks(0, mx, 4), ml, W, mr, v => (v * 100).toFixed(1) + '%');
    const sel = S.F.ab.size > 0;
    rows.forEach((r, i) => {
      const x = ml + i * bw + bw * 0.16, w = bw * 0.68, rt = rates[i], hot = base > 0 && rt > 2 * base && r.fN >= 5, y = ys(rt);
      const g = svg.append('g').attr('class', 'clk' + (sel && !S.F.ab.has(i) ? ' dim' : '')).attr('tabindex', 0).attr('role', 'button').attr('aria-label', r.label + ' fraud rate ' + fmtPct(rt, 2));
      g.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', Math.max(0, ys(0) - y)).attr('rx', 4).style('fill', hot ? 'var(--crit)' : 'var(--s1)');
      g.append('text').attr('class', 'strong num').attr('x', x + w / 2).attr('y', y - 18).attr('text-anchor', 'middle').text((hot ? '▲ ' : '') + fmtPct(rt, 2));
      g.append('text').attr('class', 'tk num').attr('x', x + w / 2).attr('y', y - 5).attr('text-anchor', 'middle').text(base ? (rt / base).toFixed(1) + '× avg' : '');
      g.append('text').attr('x', x + w / 2).attr('y', H - 30).attr('text-anchor', 'middle').attr('class', 'strong').style('font-weight', 500).text(r.label);
      g.append('text').attr('class', 'tk num').attr('x', x + w / 2).attr('y', H - 16).attr('text-anchor', 'middle').text(fmtN(r.cnt) + ' txns');
      g.append('rect').attr('class', 'hit').attr('x', ml + i * bw).attr('y', 0).attr('width', bw).attr('height', H);
      const show = ev => tipShow(ev, r.label, [{ k: 'Fraud rate', v: fmtPct(rt, 2) }, { k: 'Versus bank average', v: base ? (rt / base).toFixed(1) + '×' : '–' }, { k: 'Fraud cases', v: fmtN(r.fN) }, { k: 'Fraud exposure', v: fmtCr(r.fV) }, { k: 'Share of fraud value', v: fmtPct(safeDiv(r.fV, tFV), 1) }, { k: 'Share of transactions', v: fmtPct(safeDiv(r.cnt, tC), 2) }], 'Click to filter');
      g.on('pointermove', show).on('pointerleave', tipHide).on('click', () => { tipHide(); toggleFilter('ab', i); }).on('keydown', ev => { if (ev.key === 'Enter') toggleFilter('ab', i); });
    });
    svg.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', ys(base)).attr('y2', ys(base)).style('stroke', 'var(--ink2)').attr('stroke-dasharray', '4 4');
    svg.append('text').attr('class', 'tk').attr('x', ml + 4).attr('y', ys(base) - 4).attr('text-anchor', 'start').text('Average ' + fmtPct(base, 2));
    const hi = rows[4], lo = rows.slice(0, 4), rl = safeDiv(lo.reduce((t, r) => t + r.fN, 0), lo.reduce((t, r) => t + r.cnt, 0));
    const title = hi.cnt > 0 && rl > 0 ? `Fraud is ${(rates[4] / rl).toFixed(1)}× higher above ₹10L, where ${fmtPct(safeDiv(hi.fV, tFV), 0)} of fraud value sits in ${fmtPct(safeDiv(hi.cnt, tC), 1)} of transactions` : 'Fraud rate by ticket size';
    return { title, table: { cols: ['Bucket', 'Transactions', 'Fraud cases', 'Fraud rate', 'Fraud exposure (₹ Cr)'], rows: rows.map(r => [r.label, fmtN(r.cnt), fmtN(r.fN), fmtPct(safeDiv(r.fN, r.cnt), 2), (r.fV / 1e9).toFixed(2)]) }, note: 'Bars above twice the average (with at least 5 cases) are marked ▲ and shown in red.' };
  }
};

/* ---------- 10a. fraud by type ---------- */
CARDS.ftype = {
  q: 'Which rails does fraud use?',
  render(el, ctx) {
    const rows = catRows(ctx, 'ttype'), base = safeDiv(rows.reduce((t, r) => t + r.fN, 0), rows.reduce((t, r) => t + r.cnt, 0));
    const list = rows.filter(r => r.cnt > 0).map(r => { const rt = safeDiv(r.fN, r.cnt), hot = base && rt > 1.3 * base && r.fN >= 10; return { ...r, main: rt, flagMain: hot, color: hot ? 'var(--crit)' : 'var(--s1)', x: { fv: r.fV, fn: r.fN } }; }).sort((a, b) => b.main - a.main);
    barTable(el, { rows: list, mainLabel: 'Fraud rate', mainFmt: v => fmtPct(v, 2), selSet: S.F.ttype, onClick: k => toggleFilter('ttype', k), aria: 'Fraud rate by transaction type',
      cols: [{ key: 'fv', label: 'Fraud exposure', fmt: v => fmtCr(v), kind: 'bar', color: () => 'var(--s2)' }, { key: 'fn', label: 'Fraud cases', fmt: v => fmtN(v), kind: 'bar', color: () => 'var(--s2)' }],
      tip: r => ({ title: r.label, rows: [{ k: 'Fraud rate', v: fmtPct(r.main, 2) }, { k: 'Versus average', v: base ? (r.main / base).toFixed(1) + '×' : '–' }, { k: 'Fraud cases', v: fmtN(r.fN) }, { k: 'Fraud exposure', v: fmtCr(r.fV) }, { k: 'Transactions', v: fmtN(r.cnt) }, r.p ? { k: 'Fraud cases vs prior', v: pctTxt(r.fN, r.p.fN) } : null] }) });
    const t = list.slice(0, 2);
    return { title: t.length > 1 ? `${t[0].label} (${fmtPct(t[0].main, 2)}) and ${t[1].label} (${fmtPct(t[1].main, 2)}) top the fraud table against ${fmtPct(base, 2)} overall` : 'Fraud by rail', table: { cols: ['Type', 'Fraud rate', 'Fraud cases', 'Exposure (₹ Cr)', 'Transactions'], rows: list.map(r => [r.label, fmtPct(r.main, 2), fmtN(r.fN), (r.fV / 1e9).toFixed(2), fmtN(r.cnt)]) }, note: '▲ marks rails more than 30% above the average with at least 10 cases.' };
  }
};

/* ---------- 10b. hour x weekday heatmap ---------- */
CARDS.heat = {
  q: 'When does fraud occur?',
  render(el, ctx) {
    const { R } = ctx, W = bodyW(el), ml = 44, mr = 12, cw = (W - ml - mr) / 24, ch = Math.max(22, Math.min(34, cw * 1.1)), H = 7 * ch + 66;
    const cnt = R.heatC, fn = R.heatF, rt = i => safeDiv(fn[i], cnt[i]), all = Array.from({ length: 168 }, (_, i) => i).filter(i => cnt[i] > 0);
    const mx = d3.max(all, rt) || 0.01, mn = d3.min(all, rt) || 0;
    const c0 = cssv('--seq100'), c1 = cssv('--seq700'), colr = v => d3.interpolateRgb(c0, c1)(Math.pow(safeDiv(v - mn, mx - mn), 0.9));
    const svg = mkSvg(el, W, H, 'Fraud rate heatmap by hour and weekday');
    for (let h = 0; h < 24; h += 3) svg.append('text').attr('class', 'tk').attr('x', ml + h * cw + cw / 2).attr('y', 12).attr('text-anchor', 'middle').text(String(h).padStart(2, '0'));
    WD.forEach((w, d) => svg.append('text').attr('class', 'tk').attr('x', ml - 8).attr('y', 22 + d * ch + ch / 2 + 4).attr('text-anchor', 'end').text(w));
    const sel = S.F.hour.size > 0 || S.F.wd.size > 0;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
      const i = h * 7 + d, n = cnt[i], f = fn[i], on = S.F.hour.has(h) && S.F.wd.has(d);
      const g = svg.append('g').attr('class', 'clk');
      g.append('rect').attr('x', ml + h * cw + 1).attr('y', 22 + d * ch + 1).attr('width', cw - 2).attr('height', ch - 2).attr('rx', 3).style('fill', n ? colr(rt(i)) : 'var(--surface2)').style('stroke', on ? 'var(--accent)' : 'none').attr('stroke-width', 2.5).style('opacity', sel && !on && (S.F.hour.size && !S.F.hour.has(h) || S.F.wd.size && !S.F.wd.has(d)) ? 0.3 : 1);
      g.on('pointermove', ev => tipShow(ev, WD[d] + ' ' + String(h).padStart(2, '0') + ':00', [{ k: 'Fraud rate', v: fmtPct(rt(i), 2) }, { k: 'Fraud cases', v: fmtN(f) }, { k: 'Transactions', v: fmtN(n) }], 'Click to filter to this hour and weekday')).on('pointerleave', tipHide)
        .on('click', () => { tipHide(); const same = S.F.hour.size === 1 && S.F.hour.has(h) && S.F.wd.size === 1 && S.F.wd.has(d); S.F.hour.clear(); S.F.wd.clear(); if (!same) { S.F.hour.add(h); S.F.wd.add(d); } refresh(); });
    }
    const gid = 'hg' + Math.random().toString(36).slice(2, 7), df = svg.append('defs').append('linearGradient').attr('id', gid);
    df.append('stop').attr('offset', '0%').attr('stop-color', c0); df.append('stop').attr('offset', '100%').attr('stop-color', c1);
    const ly = 22 + 7 * ch + 16, lw = Math.min(240, W - ml - 20);
    svg.append('rect').attr('x', ml).attr('y', ly).attr('width', lw).attr('height', 8).attr('rx', 4).attr('fill', `url(#${gid})`);
    svg.append('text').attr('class', 'tk').attr('x', ml).attr('y', ly + 22).text(fmtPct(mn, 2));
    svg.append('text').attr('class', 'tk').attr('x', ml + lw).attr('y', ly + 22).attr('text-anchor', 'end').text(fmtPct(mx, 2));
    svg.append('text').attr('class', 'tk').attr('x', ml + lw + 12).attr('y', ly + 8).text('fraud rate per cell');
    // verdict from marginal tests
    const hs = [], hn = [], ds = [], dn = []; for (let h = 0; h < 24; h++) { let s = 0, n = 0; for (let d = 0; d < 7; d++) { s += fn[h * 7 + d]; n += cnt[h * 7 + d]; } hs.push(s); hn.push(n); }
    for (let d = 0; d < 7; d++) { let s = 0, n = 0; for (let h = 0; h < 24; h++) { s += fn[h * 7 + d]; n += cnt[h * 7 + d]; } ds.push(s); dn.push(n); }
    const ch1 = chiHomog(hs, hn), ch2 = chiHomog(ds, dn), tot = hs.reduce((a, b) => a + b, 0);
    let title;
    if (tot < 50) title = 'Too few fraud cases in this selection to read a time pattern';
    else if (ch1.p >= 0.01 && ch2.p >= 0.01) title = `Fraud has no time pattern: hour (${fmtP(ch1.p)}) and weekday (${fmtP(ch2.p)}) differences are within chance`;
    else { const pk = all.reduce((a, b) => rt(b) > rt(a) ? b : a, all[0]); title = `Fraud peaks on ${WD[pk % 7]} at ${String(Math.floor(pk / 7)).padStart(2, '0')}:00 (${fmtPct(rt(pk), 2)})`; }
    return { title, table: { cols: ['Hour', ...WD.map(w => w + ' fraud rate')], rows: Array.from({ length: 24 }, (_, h) => [String(h).padStart(2, '0') + ':00', ...WD.map((w, d) => fmtPct(rt(h * 7 + d), 2))]) }, note: 'Each cell holds about 30 fraud cases in the full data, so single cells are noisy; read the overall pattern, not one cell.' };
  }
};

/* ---------- 11. status by channel ---------- */
CARDS.status = {
  q: 'Where do we leak transactions?',
  render(el, ctx) {
    const rows = catRows(ctx, 'chan').filter(r => r.cnt > 0), tot = { label: 'All channels', cnt: rows.reduce((t, r) => t + r.cnt, 0), st: [0, 1, 2, 3].map(i => rows.reduce((t, r) => t + r.st[i], 0)), val: 0 };
    const list = [tot].concat(rows.slice().sort((a, b) => safeDiv(b.st[1] + b.st[2] + b.st[3], b.cnt) - safeDiv(a.st[1] + a.st[2] + a.st[3], a.cnt)));
    const W = bodyW(el), rowH = 32, top = 28, labelW = Math.min(130, W * 0.22), rightW = W < 520 ? 76 : 150, H = top + list.length * rowH + 6, bx = labelW + 8, bw = W - bx - rightW;
    const leak = r => safeDiv(r.st[1] + r.st[2] + r.st[3], r.cnt), mx = Math.max(0.01, ...list.map(leak)) * 1.08, xs = d3.scaleLinear([0, mx], [0, bw]);
    const svg = mkSvg(el, W, H, 'Non-successful transaction share by channel'), cols = ['var(--s2)', 'var(--s7)', 'var(--muted)'], names = ['Failed', 'Reversed', 'Pending'], sel = S.F.chan.size > 0;
    svg.append('text').attr('class', 'tk').attr('x', bx).attr('y', 14).text('Share of the channel’s transactions that did not complete');
    svg.append('text').attr('class', 'tk').attr('x', W).attr('y', 14).attr('text-anchor', 'end').text(W < 520 ? 'Success' : 'Success · leakage');
    list.forEach((r, i) => {
      const y = top + i * rowH, isAll = i === 0, g = svg.append('g').attr('class', (isAll ? '' : 'clk') + (sel && !isAll && !S.F.chan.has(r.k) ? ' dim' : ''));
      g.append('line').attr('class', 'grid').attr('x1', 0).attr('x2', W).attr('y1', y + rowH - 0.5).attr('y2', y + rowH - 0.5);
      g.append('text').attr('x', 0).attr('y', y + rowH / 2 + 4).attr('class', 'strong').style('font-weight', isAll ? 700 : 500).text(r.label);
      let x = bx;
      [1, 2, 3].forEach((s, q) => { const w = Math.max(0, xs(safeDiv(r.st[s], r.cnt))); g.append('rect').attr('x', x).attr('y', y + 6).attr('width', Math.max(0, w - 2)).attr('height', rowH - 12).attr('rx', 3).style('fill', cols[q]);
        if (w > 34) g.append('text').attr('x', x + (w - 2) / 2).attr('y', y + rowH / 2 + 4).attr('text-anchor', 'middle').style('fill', '#fff').style('font-weight', 600).text(fmtPct(safeDiv(r.st[s], r.cnt), 1)); x += w; });
      g.append('text').attr('class', 'num').attr('x', W).attr('y', y + rowH / 2 + 4).attr('text-anchor', 'end').style('fill', 'var(--ink)').text(W < 520 ? fmtPct(safeDiv(r.st[0], r.cnt), 1) : fmtPct(safeDiv(r.st[0], r.cnt), 1) + ' · ' + fmtPct(leak(r), 1));
      g.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y).attr('width', W).attr('height', rowH);
      g.on('pointermove', ev => tipShow(ev, r.label, [{ k: 'Transactions', v: fmtN(r.cnt) }, { k: 'Success', v: fmtPct(safeDiv(r.st[0], r.cnt), 2) }, { k: 'Failed', v: fmtPct(safeDiv(r.st[1], r.cnt), 2), c: cols[0] }, { k: 'Reversed', v: fmtPct(safeDiv(r.st[2], r.cnt), 2), c: cols[1] }, { k: 'Pending', v: fmtPct(safeDiv(r.st[3], r.cnt), 2), c: cols[2] }], isAll ? '' : 'Click to filter')).on('pointerleave', tipHide);
      if (!isAll) g.on('click', () => { tipHide(); toggleFilter('chan', r.k); });
    });
    const fr = rows.map(r => safeDiv(r.st[1], r.cnt)), spread = Math.max(...fr) - Math.min(...fr), t = tot;
    const title = rows.length ? `About ${fmtPct(leak(t), 1)} of transactions do not complete (failed ${fmtPct(safeDiv(t.st[1], t.cnt), 1)}), and channels differ by only ${(spread * 100).toFixed(2)} points on failures` : 'No data';
    return { title, legend: names.map((n, q) => ({ t: n, c: cols[q] })), table: { cols: ['Channel', 'Success', 'Failed', 'Reversed', 'Pending'], rows: list.map(r => [r.label, ...[0, 1, 2, 3].map(s => fmtPct(safeDiv(r.st[s], r.cnt), 2))]) }, note: 'Success makes up the rest of each channel (about 92%). The bars show only the part that leaks.' };
  }
};

/* ---------- 12a. loan portfolio ---------- */
CARDS.loan = {
  q: 'What does the loan book look like?',
  render(el, ctx) {
    const { R } = ctx, rows = catRows(ctx, 'loan').map(r => ({ ...r, cust: R.custLoan[r.k] }));
    const loans = rows.filter(r => r.k > 0 && r.cnt > 0).map(r => ({ ...r, main: r.emi, x: { cust: r.cust, avg: safeDiv(r.emi, r.ln) / 100 } })).sort((a, b) => b.main - a.main);
    const none = rows[0], list = loans.concat(none.cnt > 0 ? [{ ...none, main: 0, x: { cust: none.cust, avg: 0 } }] : []);
    const totE = loans.reduce((t, r) => t + r.emi, 0);
    barTable(el, { rows: list, mainLabel: 'EMI book (sum of EMIs on loan transactions)', mainFmt: v => v ? fmtCr(v) : '–', selSet: S.F.loan, onClick: k => toggleFilter('loan', k), aria: 'Loan portfolio by type',
      cols: [{ key: 'cust', label: 'Customers', fmt: v => fmtN(v), kind: 'bar', color: () => 'var(--s3)' }, { key: 'avg', label: 'Avg EMI', fmt: v => v ? fmtInr(v) : '–', kind: 'dot', color: () => 'var(--s2)' }],
      tip: r => ({ title: r.label, rows: [{ k: 'EMI book', v: fmtCr(r.emi) }, { k: 'Share of EMI book', v: fmtPct(safeDiv(r.emi, totE), 1) }, { k: 'Loan transactions', v: fmtN(r.ln) }, { k: 'Distinct customers', v: fmtN(r.cust) }, { k: 'Average EMI', v: r.ln ? fmtInr(safeDiv(r.emi, r.ln) / 100) : '–' }, r.p && r.p.emi ? { k: 'EMI book vs prior', v: pctTxt(r.emi, r.p.emi) } : null] }) });
    const top = loans[0], un = loans.find(r => r.k === 7);
    return { title: top ? `${top.label} is the largest EMI book at ${fmtCr(top.emi)} (${fmtPct(safeDiv(top.emi, totE), 0)} of EMIs)${un ? `; ${fmtPct(safeDiv(un.emi, totE), 0)} has no loan type recorded` : ''}` : 'No loan transactions in this selection',
      table: { cols: ['Loan type', 'EMI book (₹ Cr)', 'Loan transactions', 'Customers', 'Avg EMI (₹)'], rows: list.map(r => [r.label, (r.emi / 1e9).toFixed(2), fmtN(r.ln), fmtN(r.cust), r.ln ? fmtN(safeDiv(r.emi, r.ln) / 100) : '–']) },
      note: 'EMI book adds the EMI on every loan transaction, so it measures instalment exposure through activity, not outstanding principal. Loan type is recorded per transaction, so a customer can appear under more than one type.' };
  }
};

/* ---------- 12b. EMI to balance ---------- */
CARDS.emi = {
  q: 'Which borrowers are stretched?',
  render(el, ctx) {
    const { R } = ctx, W = bodyW(el), H = 290, ml = 44, mr = 10, pw = W - ml - mr, bw = pw / 5, tot = R.stressC.reduce((a, b) => a + b, 0);
    const names = ['Under 5%', '5–10%', '10–25%', '25–50%', 'Over 50%'], risk = ['Comfortable', 'Comfortable', 'Watch', 'Strained', 'Severe'], icons = ['●', '●', '▲', '▲', '■'];
    const colr = ['var(--good)', 'var(--good)', 'var(--warn)', 'var(--serious)', 'var(--crit)'], tcol = ['var(--goodText)', 'var(--goodText)', 'var(--warnText)', 'var(--critText)', 'var(--critText)'];
    const mx = Math.max(1, ...R.stressC) * 1.2, ys = d3.scaleLinear([0, mx], [H - 56, 26]), svg = mkSvg(el, W, H, 'Loan transactions by EMI-to-balance ratio');
    yGrid(svg, ys, d3.ticks(0, mx, 4), ml, W, mr, v => v >= 1000 ? Math.round(v / 1000) + 'k' : v);
    names.forEach((n, i) => {
      const x = ml + i * bw + bw * 0.16, w = bw * 0.68, v = R.stressC[i], y = ys(v), g = svg.append('g');
      g.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', Math.max(0, ys(0) - y)).attr('rx', 4).style('fill', colr[i]);
      g.append('text').attr('class', 'strong num').attr('x', x + w / 2).attr('y', y - 18).attr('text-anchor', 'middle').text(fmtPct(safeDiv(v, tot), 1));
      g.append('text').attr('class', 'tk num').attr('x', x + w / 2).attr('y', y - 5).attr('text-anchor', 'middle').text(fmtN(v));
      g.append('text').attr('x', x + w / 2).attr('y', H - 36).attr('text-anchor', 'middle').attr('class', 'strong').style('font-weight', 500).text(n);
      g.append('text').attr('x', x + w / 2).attr('y', H - 20).attr('text-anchor', 'middle').style('fill', tcol[i]).style('font-weight', 700).style('font-size', '11px').text(icons[i] + ' ' + risk[i]);
      g.append('rect').attr('class', 'hit').attr('x', ml + i * bw).attr('y', 0).attr('width', bw).attr('height', H);
      g.on('pointermove', ev => tipShow(ev, 'EMI is ' + n + ' of balance', [{ k: 'Loan transactions', v: fmtN(v) }, { k: 'Share of loan transactions', v: fmtPct(safeDiv(v, tot), 1) }, { k: 'EMI on these', v: fmtCr(R.stressE[i]) }, { k: 'Rating', v: risk[i] }])).on('pointerleave', tipHide);
    });
    svg.append('text').attr('class', 'tk').attr('x', W - mr).attr('y', 12).attr('text-anchor', 'end').text('EMI as a share of the account balance on that transaction');
    const hi = R.stressC[3] + R.stressC[4], he = R.stressE[3] + R.stressE[4];
    return { title: tot ? `${fmtPct(safeDiv(hi, tot), 0)} of loan transactions carry an EMI above a quarter of the balance (${fmtCr(he)} of EMIs)` : 'No loan transactions in this selection', table: { cols: ['EMI ÷ balance', 'Loan transactions', 'Share', 'EMI (₹ Cr)', 'Rating'], rows: names.map((n, i) => [n, fmtN(R.stressC[i]), fmtPct(safeDiv(R.stressC[i], tot), 1), (R.stressE[i] / 1e9).toFixed(2), risk[i]]) }, note: 'Ratio uses the balance recorded on each transaction. Green under 10%, amber 10–25%, red above 25%.' };
  }
};

/* ---------- 13. credit score ---------- */
CARDS.score = {
  q: 'Does credit score tell us about risk or loan uptake?',
  render(el, ctx) {
    const rows = catRows(ctx, 'sb'), tc = rows.reduce((t, r) => t + r.cnt, 0), fr = rows.filter(r => r.cnt > 0).map(r => safeDiv(r.fN, r.cnt)), lu = rows.filter(r => r.cnt > 0).map(r => safeDiv(r.ln, r.cnt));
    const list = rows.filter(r => r.cnt > 0).map(r => ({ ...r, main: safeDiv(r.cnt, tc), x: { fr: safeDiv(r.fN, r.cnt), ln: safeDiv(r.ln, r.cnt) } }));
    const fmax = Math.max(0.012, ...fr) * 1.1;
    barTable(el, { rows: list, mainLabel: 'Share of transactions', mainFmt: v => fmtPct(v, 1), selSet: S.F.sb, onClick: k => toggleFilter('sb', k), aria: 'Credit score bands',
      cols: [{ key: 'fr', label: 'Fraud rate', fmt: v => fmtPct(v, 2), kind: 'dot', max: fmax, color: () => 'var(--s1)' }, { key: 'ln', label: 'Loan uptake', fmt: v => fmtPct(v, 0), kind: 'dot', max: 1, color: () => 'var(--s2)' }],
      tip: r => ({ title: 'Score ' + r.label, rows: [{ k: 'Transactions', v: fmtN(r.cnt) }, { k: 'Fraud rate', v: fmtPct(safeDiv(r.fN, r.cnt), 2) }, { k: 'Loan uptake (txns with a loan)', v: fmtPct(safeDiv(r.ln, r.cnt), 1) }, { k: 'Value', v: fmtCr(r.val) }, r.p ? { k: 'Count vs prior', v: pctTxt(r.cnt, r.p.cnt) } : null] }) });
    const flatF = fr.length > 2 && (Math.max(...fr) - Math.min(...fr)) < 0.0035, flatL = lu.length > 2 && (Math.max(...lu) - Math.min(...lu)) < 0.04;
    const title = !list.length ? 'No data' : flatF && flatL ? `Credit score tells us nothing here: fraud stays ${fmtPct(Math.min(...fr), 2)}–${fmtPct(Math.max(...fr), 2)} and loan uptake near ${fmtPct(mean(lu), 0)} in every band` : flatF ? `Fraud is flat across score bands (${fmtPct(Math.min(...fr), 2)}–${fmtPct(Math.max(...fr), 2)}), but loan uptake varies` : 'Fraud rate varies across credit-score bands';
    return { title, table: { cols: ['Score band', 'Transactions', 'Share', 'Fraud rate', 'Loan uptake'], rows: list.map(r => [r.label, fmtN(r.cnt), fmtPct(r.main, 1), fmtPct(r.x.fr, 2), fmtPct(r.x.ln, 1)]) }, note: 'Bands are in score order, not sorted by size. Loan uptake is the share of transactions made with a loan on the account.' };
  }
};

/* ---------- 14. KYC ---------- */
CARDS.kyc = {
  q: 'How exposed are we on compliance?',
  render(el, ctx) {
    const { R } = ctx, rows = catRows(ctx, 'kyc').filter(r => r.cnt > 0).map(r => ({ ...r, cust: R.custKyc[r.k] })), tv = rows.reduce((t, r) => t + r.val, 0), base = safeDiv(rows.reduce((t, r) => t + r.fN, 0), rows.reduce((t, r) => t + r.cnt, 0));
    const list = rows.map(r => ({ ...r, main: mval(r, S.metric), color: r.k === 0 ? 'var(--s1)' : 'var(--accent)', x: { fr: safeDiv(r.fN, r.cnt), fv: r.fV } })).sort((a, b) => b.main - a.main);
    const holder = document.createElement('div'), tail = document.createElement('div'); el.replaceChildren(holder, tail);
    barTable(holder, { rows: list, mainLabel: MET[S.metric].name, mainFmt: MET[S.metric].fmt, selSet: S.F.kyc, onClick: k => toggleFilter('kyc', k), aria: 'KYC status', rowH: 32,
      cols: [{ key: 'fr', label: 'Fraud rate', fmt: v => fmtPct(v, 2), kind: 'dot', max: Math.max(0.012, base * 1.5), color: () => 'var(--s1)' }, { key: 'fv', label: 'Fraud exposure', fmt: v => fmtCr(v), kind: 'bar', color: () => 'var(--s2)' }],
      tip: r => ({ title: 'KYC ' + r.label, rows: catTipRows(r, rows, ctx).concat([{ k: 'Distinct customers', v: fmtN(r.cust) }]) }) });
    const o = R.ov;
    tail.className = 'stat3'; tail.style.marginTop = '8px';
    [[fmtN(o.khbCust), 'customers with KYC pending or expired and a balance of ₹10L or more'], [fmtCr(o.khbBal * 100), 'their combined peak balances'], [fmtCr(o.khbVal), 'value they moved in the period']].forEach(([a, b]) => { const s = document.createElement('div'); s.className = 'stat'; const bb = document.createElement('b'); bb.textContent = a; const sp = document.createElement('span'); sp.textContent = b; s.append(bb, sp); tail.appendChild(s); });
    const nv = rows.filter(r => r.k > 0).reduce((t, r) => t + r.val, 0);
    return { title: tv ? (() => { const nr = safeDiv(rows.filter(r => r.k > 0).reduce((t, r) => t + r.fN, 0), rows.filter(r => r.k > 0).reduce((t, r) => t + r.cnt, 0)); return `${fmtPct(safeDiv(nv, tv), 1)} of value moves without verified KYC; fraud there is ${nr > base * 1.15 ? 'higher' : nr < base * 0.85 ? 'lower' : 'no different'} (${fmtPct(nr, 2)} vs ${fmtPct(base, 2)} overall)`; })() : 'No data', table: { cols: ['KYC status', 'Value (₹ Cr)', 'Transactions', 'Fraud rate', 'Fraud exposure (₹ Cr)', 'Customers'], rows: list.map(r => [r.label, (r.val / 1e9).toFixed(2), fmtN(r.cnt), fmtPct(r.x.fr, 2), (r.fV / 1e9).toFixed(2), fmtN(r.cust)]) }, note: 'KYC gaps are a compliance exposure, not a fraud signal in this data. Customers can appear in more than one status because KYC is recorded per transaction.', keepTail: true };
  }
};

/* ---------- 15. top customers ---------- */
CARDS.top = {
  q: 'Who are our biggest customers, and are any flagged?',
  render(el, ctx) {
    const { R } = ctx, top = R.top, ov = R.ov, tc = top.reduce((t, r) => t + r.val, 0);
    const wrap = document.createElement('div'); wrap.className = 'tblwrap'; const t = document.createElement('table'); t.className = 'tbl';
    const head = ['#', 'Customer', 'Value', 'Share of total', 'Transactions', 'Fraud cases', 'Fraud value', 'KYC not verified', 'Flags'];
    const thead = document.createElement('thead'), hr = document.createElement('tr');
    head.forEach((h, i) => { const th = document.createElement('th'); th.textContent = h; if (i >= 2 && i <= 7) th.className = 'r'; hr.appendChild(th); }); thead.appendChild(hr); t.appendChild(thead);
    const tb = document.createElement('tbody');
    top.forEach((r, i) => {
      const tr = document.createElement('tr'), kycSh = safeDiv(r.kN, r.n), flags = [];
      if (r.fN > 0) flags.push(['Fraud', 'crit', '▲']); if (kycSh > 0.25) flags.push(['KYC', 'warn', '▲']);
      const cells = [[i + 1, ''], ['CUST' + String(r.id).padStart(6, '0'), ''], [fmtCr(r.val), 'r'], [fmtPct(safeDiv(r.val, ov.val), 3), 'r'], [fmtN(r.n), 'r'], [fmtN(r.fN), 'r' + (r.fN > 0 ? ' cf-crit' : '')], [r.fN ? fmtCr(r.fV) : '–', 'r' + (r.fN > 0 ? ' cf-crit' : '')], [fmtPct(kycSh, 0), 'r' + (kycSh > 0.25 ? ' cf-warn' : '')]];
      cells.forEach(([v, c]) => { const td = document.createElement('td'); td.textContent = v; td.className = c; tr.appendChild(td); });
      const tdf = document.createElement('td'); if (!flags.length) tdf.textContent = 'Clear'; flags.forEach(f => { const sp = document.createElement('span'); sp.className = 'pill ' + f[1]; sp.style.marginRight = '4px'; sp.textContent = f[2] + ' ' + f[0]; tdf.appendChild(sp); }); tr.appendChild(tdf); tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); el.replaceChildren(wrap);
    const nf_ = top.filter(r => r.fN > 0).length, nk = top.filter(r => safeDiv(r.kN, r.n) > 0.25).length;
    return { title: top.length ? `The ten largest customers hold ${fmtPct(safeDiv(tc, ov.val), 2)} of value: no concentration risk; ${nf_} have fraud cases and ${nk} have a KYC gap` : 'No customers in this selection', table: null, note: 'Customer value is summed over the selected transactions. Flags: ▲ Fraud = any fraud-flagged transaction; ▲ KYC = more than 25% of their transactions had KYC pending or expired.' };
  }
};

/* ---------- KPI cards ---------- */
function sparkSvg(vals, W, H) {
  const mx = d3.max(vals) || 1, mn = Math.min(0, d3.min(vals) || 0), ys = d3.scaleLinear([mn, mx * 1.05 || 1], [H - 3, 3]), n = vals.length, xs = i => n === 1 ? W / 2 : 2 + i * (W - 4) / (n - 1);
  const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('aria-hidden', 'true');
  if (n > 1) { svg.append('path').attr('d', d3.area().x((d, i) => xs(i)).y0(H - 3).y1(d => ys(d)).curve(d3.curveMonotoneX)(vals)).style('fill', 'var(--s1)').style('opacity', 0.15);
    svg.append('path').attr('d', d3.line().x((d, i) => xs(i)).y(d => ys(d)).curve(d3.curveMonotoneX)(vals)).attr('fill', 'none').style('stroke', 'var(--s1)').attr('stroke-width', 1.8); }
  svg.append('circle').attr('cx', xs(n - 1)).attr('cy', ys(vals[n - 1])).attr('r', 3.5).style('fill', 'var(--s1)').style('stroke', 'var(--surface)').attr('stroke-width', 1.5);
  return svg.node();
}
const KPI_DEF = [
  { id: 'val', label: 'Total transaction value', def: 'Sum of transaction_amount over every transaction in the selection, credits and debits together. This is money moved, not revenue or profit.' },
  { id: 'cnt', label: 'Transactions', def: 'Number of transaction rows in the selection, all statuses included.' },
  { id: 'net', label: 'Net flow', def: 'Credits minus debits over the selection. Negative means more money left customer accounts than arrived.' },
  { id: 'fraud', label: 'Fraud rate', def: 'Transactions with is_fraud = 1 divided by all transactions. Exposure is the combined value of those transactions.' },
  { id: 'leak', label: 'Failed + reversed', def: 'Share of transactions with status Failed or Reversed. Their value is revenue at risk. Pending items are excluded.' },
  { id: 'cust', label: 'Active customers', def: 'Distinct customer_id with at least one transaction in the selection.' }
];
function renderKPIs(ctx) {
  const { R, C, cr } = ctx, o = R.ov, p = C ? C.ov : null, host = $('#kpis');
  const grain = (S.b - S.a + 1) > 100 ? 'month' : 'day', bks = fillSeries(R, makeBuckets(S.a, S.b, grain));
  const cmpTxt = cr ? 'vs ' + rangeText(cr[0], cr[1]) : 'no prior period in the data';
  const medAll = medianHist(R.hist, 0);
  const defs = {
    val: { v: fmtCr(o.val), cur: o.val, prev: p && p.val, up: 1, sub: `Median ticket ≈ ${fmtInr(medAll)} · average ${fmtInr(safeDiv(o.val, o.cnt) / 100)}`, sp: bks.map(b => b.val), dfmt: 'pct' },
    cnt: { v: fmtN(o.cnt), cur: o.cnt, prev: p && p.cnt, up: 1, sub: `${fmtN(safeDiv(o.cnt, bks.length))} per ${grain}`, sp: bks.map(b => b.cnt), dfmt: 'pct' },
    net: { v: fmtCr(o.cred * 2 - o.val), cur: o.cred * 2 - o.val, prev: p && (p.cred * 2 - p.val), up: 1, sub: `Credits ${fmtCr(o.cred)} · debits ${fmtCr(o.val - o.cred)}`, sp: bks.map(b => b.cred - b.deb), dfmt: 'pct' },
    fraud: { v: fmtPct(safeDiv(o.fN, o.cnt), 2), cur: safeDiv(o.fN, o.cnt), prev: p && safeDiv(p.fN, p.cnt), up: -1, sub: `Exposure ${fmtCr(o.fV)} · ${fmtN(o.fN)} cases`, sp: bks.map(b => safeDiv(b.fN, b.cnt)), dfmt: 'pp' },
    leak: { v: fmtPct(safeDiv(o.frN, o.cnt), 1), cur: safeDiv(o.frN, o.cnt), prev: p && safeDiv(p.frN, p.cnt), up: -1, sub: `${fmtCr(o.frV)} at risk · ${fmtN(o.pendN)} pending`, sp: bks.map(b => safeDiv(b.frN, b.cnt)), dfmt: 'pp' },
    cust: { v: fmtN(o.cust), cur: o.cust, prev: p && p.cust, up: 1, sub: `${fmtN(safeDiv(o.cnt, o.cust) * 10 / 10)} transactions per customer`.replace(/^([\d,]+) /, (m, a) => safeDiv(o.cnt, o.cust).toFixed(1) + ' '), sp: bks.map(b => b.cust), dfmt: 'pct' }
  };
  if (!host.children.length) {
    KPI_DEF.forEach(k => { const d = document.createElement('div'); d.className = 'kpi'; d.id = 'kpi-' + k.id;
      d.innerHTML = '<div class="kl"><span class="kn"></span><button class="info" type="button" aria-label="How this is calculated">i</button></div><div class="kv num"></div><div class="ks"></div><div class="kd"></div><div class="ksp"></div>';
      d.querySelector('.kn').textContent = k.label;
      const ib = d.querySelector('.info'), show = ev => { const b = ib.getBoundingClientRect(); tipShow({ clientX: b.left, clientY: b.bottom }, 'How this is calculated', [], k.def); };
      ib.addEventListener('pointerenter', show); ib.addEventListener('focus', show); ib.addEventListener('pointerleave', tipHide); ib.addEventListener('blur', tipHide); ib.addEventListener('click', show);
      host.appendChild(d); });
  }
  KPI_DEF.forEach(k => {
    const d = defs[k.id], card = $('#kpi-' + k.id);
    $('.kv', card).textContent = d.v; $('.ks', card).textContent = d.sub;
    const kd = $('.kd', card); kd.replaceChildren();
    const dl = document.createElement('span'); dl.className = 'delta';
    if (d.prev == null || d.prev === false) { dl.className += ' flat'; dl.textContent = '– n/a'; const l = document.createElement('div'); l.className = 'dl'; l.textContent = cmpTxt; kd.append(dl, l); }
    else {
      const diff = d.cur - d.prev, rel = d.dfmt === 'pp' ? diff : safeDiv(diff, Math.abs(d.prev)), flat = d.dfmt === 'pp' ? Math.abs(diff) < 0.0002 : Math.abs(rel) < 0.005, good = flat ? 0 : (diff > 0 ? 1 : -1) * d.up;
      dl.className += flat ? ' flat' : good > 0 ? ' good' : ' bad';
      dl.textContent = (flat ? '● ' : diff > 0 ? '▲ ' : '▼ ') + (d.dfmt === 'pp' ? (diff >= 0 ? '+' : '−') + Math.abs(diff * 100).toFixed(2) + ' pp' : fmtPctS(rel));
      const l = document.createElement('div'); l.className = 'dl'; l.textContent = cmpTxt + (flat ? ' (flat)' : good > 0 ? ' (better)' : ' (worse)'); kd.append(dl, l);
    }
    const sp = $('.ksp', card); sp.replaceChildren(); if (d.sp.length && d.sp[0] != null) sp.appendChild(sparkSvg(d.sp.map(x => x || 0), 200, 38));
  });
}

/* ---------- rail group donut ---------- */
function renderSnap(ctx) {
  const { R } = ctx, A = R.full[DBY.ttype.j], g = [0, 0, 0, 0], gm = [[], [], [], []];
  META.labels.ttype.forEach((t, k) => { g[GROUP_OF[t]] += A[k * NM + M_VAL]; gm[GROUP_OF[t]].push(k); });
  const tot = g.reduce((a, b) => a + b, 0), el = $('#snapBody'), W = bodyW(el), H = 200;
  el.replaceChildren();
  const svg = mkSvg(el, W, H, 'Value by rail group'), r = 84, cx = W / 2, cy = H / 2;
  const pie = d3.pie().sort(null).value(d => d)(g), arc = d3.arc().innerRadius(r * 0.62).outerRadius(r).padAngle(0.02).cornerRadius(3);
  const sel = S.F.ttype.size > 0;
  pie.forEach((s, i) => {
    const on = gm[i].length && gm[i].every(k => S.F.ttype.has(k)) && S.F.ttype.size === gm[i].length;
    svg.append('path').attr('transform', `translate(${cx},${cy})`).attr('d', arc(s)).style('fill', CAT[i]).attr('class', 'clk' + (sel && !on ? ' dim' : '')).attr('tabindex', 0).attr('role', 'button').attr('aria-label', GROUPS[i])
      .on('pointermove', ev => tipShow(ev, GROUPS[i], [{ k: 'Value', v: fmtCr(g[i]) }, { k: 'Share of value', v: fmtPct(safeDiv(g[i], tot), 1) }], 'Click to filter to this group'))
      .on('pointerleave', tipHide).on('click', () => { tipHide(); const same = on; S.F.ttype.clear(); if (!same) gm[i].forEach(k => S.F.ttype.add(k)); refresh(); });
  });
  svg.append('text').attr('x', cx).attr('y', cy - 2).attr('text-anchor', 'middle').attr('class', 'strong num').style('font-size', '15px').text(fmtCr(tot));
  svg.append('text').attr('x', cx).attr('y', cy + 14).attr('text-anchor', 'middle').attr('class', 'tk').text('moved');
  const lg = document.createElement('div'); lg.className = 'legend'; lg.style.flexDirection = 'column'; lg.style.marginTop = '6px';
  GROUPS.forEach((n, i) => { const s = document.createElement('span'); s.innerHTML = '<i></i>'; s.firstChild.style.background = CAT[i]; s.appendChild(document.createTextNode(n.split(' (')[0] + ' ' + fmtPct(safeDiv(g[i], tot), 1))); lg.appendChild(s); });
  el.appendChild(lg);
  $('#snapNote').textContent = tot ? `${GROUPS[g.indexOf(Math.max(...g))].split(' (')[0]} is the largest group at ${fmtPct(Math.max(...g) / tot, 0)} of value.` : '';
}
