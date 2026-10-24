/* ================= time buckets, statistics, insight engine ================= */
const GR = ['year', 'quarter', 'month', 'day'];
function unitBounds(grain, d) {
  const y = dYear[d], t = dayDate(d), m = t.getUTCMonth();
  if (grain === 'year') return [dateToDay(y, 0, 1), dateToDay(y + 1, 0, 1) - 1];
  if (grain === 'quarter') { const q = Math.floor(m / 3) * 3; return [dateToDay(y, q, 1), dateToDay(y, q + 3, 1) - 1]; }
  if (grain === 'month') return [dateToDay(y, m, 1), dateToDay(y, m + 1, 1) - 1];
  return [d, d];
}
function bucketLabel(grain, d, short) {
  const y = dYear[d], m = dayDate(d).getUTCMonth();
  if (grain === 'year') return String(y);
  if (grain === 'quarter') return 'Q' + (Math.floor(m / 3) + 1) + ' ' + y;
  if (grain === 'month') return MON[m] + (short ? " '" + String(y).slice(2) : ' ' + y);
  return short ? String(dayDate(d).getUTCDate()) + ' ' + MON[m] : dayLabel(d);
}
function keyOf(grain, d) { return grain === 'year' ? dYear[d] : grain === 'quarter' ? dQ[d] : grain === 'month' ? dMon[d] : d; }
function makeBuckets(a, b, grain) {
  const out = []; let cur = null;
  for (let d = a; d <= b; d++) {
    const k = keyOf(grain, d);
    if (!cur || cur.key !== k) {
      const ub = unitBounds(grain, d);
      cur = { key: k, s: d, e: d, label: bucketLabel(grain, d), short: bucketLabel(grain, d, true), grain, partial: false, ub };
      out.push(cur);
    } else cur.e = d;
  }
  out.forEach(x => { x.partial = x.s !== x.ub[0] || x.e !== x.ub[1]; });
  return out;
}
const rsum = (arr, s, e) => { let t = 0; for (let d = s; d <= e; d++) t += arr[d]; return t; };
function fillSeries(R, bks) {
  for (const x of bks) {
    x.cnt = rsum(R.dCnt, x.s, x.e); x.val = rsum(R.dVal, x.s, x.e); x.cred = rsum(R.dCred, x.s, x.e); x.deb = x.val - x.cred;
    x.fN = rsum(R.dFN, x.s, x.e); x.fV = rsum(R.dFV, x.s, x.e); x.frN = rsum(R.dFR, x.s, x.e); x.frV = rsum(R.dFRV, x.s, x.e);
    x.ttV = new Array(10).fill(0); x.ttC = new Array(10).fill(0);
    for (let d = x.s; d <= x.e; d++) for (let t = 0; t < 10; t++) { x.ttV[t] += R.dTTv[d * 10 + t]; x.ttC[t] += R.dTTc[d * 10 + t]; }
    if (x.grain === 'month') x.cust = R.mCust[x.key]; else if (x.grain === 'day') x.cust = R.dCust[x.s]; else x.cust = null;
  }
  return bks;
}
function autoGrain(a, b) { return (b - a + 1) > 150 ? 'month' : 'day'; }
function curGrain() { return S.grain === 'auto' ? autoGrain(S.a, S.b) : S.grain; }

function rangeText(a, b) {
  const da = dayDate(a), db = dayDate(b), ya = da.getUTCFullYear();
  if (a === dateToDay(ya, 0, 1) && b === dateToDay(ya + 1, 0, 1) - 1) return 'CY' + ya;
  if (a === 0 && b === LAST_FULL_DAY) return '2019–2023';
  const ma = da.getUTCMonth();
  if (ma % 3 === 0 && a === dateToDay(ya, ma, 1) && b === dateToDay(ya, ma + 3, 1) - 1) return 'Q' + (ma / 3 + 1) + ' ' + ya;
  if (a === dateToDay(ya, ma, 1) && b === dateToDay(ya, ma + 1, 1) - 1) return MON[ma] + ' ' + ya;
  return dayLabel(a) + ' – ' + dayLabel(b);
}

/* ---------- statistics ---------- */
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015;
  for (let j = 0; j < 6; j++) s += c[j] / ++y;
  return -t + Math.log(2.5066282746310005 * s / x);
}
function gammaP(a, x) {
  if (x <= 0) return 0;
  const g = Math.exp(-x + a * Math.log(x) - lgamma(a));
  if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-13) break; } return sum * g; }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-13) break; }
  return 1 - g * h;
}
const chi2sf = (x, df) => Math.max(0, 1 - gammaP(df / 2, x / 2));
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
function zTest(s1, n1, s2, n2) {
  if (n1 < 1 || n2 < 1) return { z: 0, p: 1 };
  const p = (s1 + s2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return { z: 0, p: 1 };
  const z = (s1 / n1 - s2 / n2) / se; return { z, p: erfc(Math.abs(z) / Math.SQRT2) };
}
function chiHomog(s, n) {
  const idx = n.map((x, i) => i).filter(i => n[i] > 0);
  const S_ = idx.reduce((t, i) => t + s[i], 0), N_ = idx.reduce((t, i) => t + n[i], 0);
  const p = S_ / N_; if (idx.length < 2 || p <= 0 || p >= 1) return { chi: 0, df: Math.max(1, idx.length - 1), p: 1 };
  let chi = 0; idx.forEach(i => { const e = n[i] * p; chi += (s[i] - e) ** 2 / (n[i] * p * (1 - p)); });
  const df = idx.length - 1; return { chi, df, p: chi2sf(chi, df) };
}
const fmtP = p => p < 0.001 ? 'p < 0.001' : 'p = ' + p.toFixed(p < 0.01 ? 3 : 2);
const mean = a => a.reduce((t, x) => t + x, 0) / (a.length || 1);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

/* ---------- per-dimension helpers (read the f==0 ("full") accumulators) ---------- */
const FA = (R, key, k, m) => R.full[DBY[key].j][k * NM + m];
const CA = (R, key, k, m) => R.cross[DBY[key].j][k * NM + m];
const rate = (n, d) => (d ? n / d : 0);

/* ---------- hypotheses ---------- */
function hypotheses(R) {
  const ov = R.ov, out = [];
  const tt = k => ({ n: FA(R, 'ttype', k, M_CNT), f: FA(R, 'ttype', k, M_FN) });
  const tIdx = n => META.labels.ttype.indexOf(n);
  const verdictOf = (c, small) => small ? 'na' : c ? 'ok' : 'no';
  // (a) high value carry disproportionate fraud
  { const hi = { n: FA(R, 'ab', 4, M_CNT), f: FA(R, 'ab', 4, M_FN) };
    let nlo = 0, flo = 0; for (let k = 0; k < 4; k++) { nlo += FA(R, 'ab', k, M_CNT); flo += FA(R, 'ab', k, M_FN); }
    const small = hi.n < 30 || ov.fN < 20, z = zTest(hi.f, hi.n, flo, nlo), rh = rate(hi.f, hi.n), rl = rate(flo, nlo);
    const conf = z.p < 0.01 && rh > 1.5 * rl;
    out.push({ id: 'a', title: 'High-value transactions carry disproportionate fraud', verdict: small ? 'na' : conf ? 'ok' : 'no', label: small ? 'Too little data' : conf ? 'Confirmed' : 'Rejected',
      head: small ? 'Not enough transactions above ₹10L in this selection' : `${fmtPct(rh, 2)} above ₹10L vs ${fmtPct(rl, 2)} below (${rl ? (rh / rl).toFixed(1) : '–'}×)`,
      ev: `${fmtN(hi.f)} frauds in ${fmtN(hi.n)} transactions above ₹10L; ${fmtP(z.p)}`, hi, rh, rl, z }); }
  // (b) RTGS & Cheque riskier than digital
  { let nd = 0, fd = 0; DIGITAL_TYPES.forEach(t => { const x = tt(tIdx(t)); nd += x.n; fd += x.f; });
    const r = tt(tIdx('RTGS')), c = tt(tIdx('Cheque')), zr = zTest(r.f, r.n, fd, nd), zc = zTest(c.f, c.n, fd, nd), rd = rate(fd, nd);
    const hr = zr.p < 0.01 && rate(r.f, r.n) > rd, hc = zc.p < 0.01 && rate(c.f, c.n) > rd, small = r.n < 30 || c.n < 30 || fd < 20;
    out.push({ id: 'b', title: 'RTGS and Cheque are riskier than digital rails', verdict: small ? 'na' : (hr && hc) ? 'ok' : (hr || hc) ? 'part' : 'no', label: small ? 'Too little data' : (hr && hc) ? 'Confirmed' : (hr || hc) ? 'Partly confirmed' : 'Rejected',
      head: small ? 'Not enough RTGS or Cheque transactions here' : `RTGS ${fmtPct(rate(r.f, r.n), 2)}, Cheque ${fmtPct(rate(c.f, c.n), 2)} vs digital ${fmtPct(rd, 2)}`,
      ev: `RTGS ${fmtP(zr.p)}; Cheque ${fmtP(zc.p)} (digital = UPI, IMPS, NEFT, Net Banking, POS, Credit Card, Auto Debit)`, rr: rate(r.f, r.n), rc: rate(c.f, c.n), rd, r, c, fd, nd }); }
  // (c) credit score does NOT predict fraud
  { const s = [], n = []; for (let k = 0; k < 5; k++) { s.push(FA(R, 'sb', k, M_FN)); n.push(FA(R, 'sb', k, M_CNT)); }
    const ch = chiHomog(s, n), rates = n.map((x, i) => rate(s[i], x)).filter((x, i) => n[i] > 0), small = ov.fN < 20 || rates.length < 3;
    const conf = ch.p >= 0.01;
    out.push({ id: 'c', title: 'Credit score does not predict fraud', verdict: small ? 'na' : conf ? 'ok' : 'no', label: small ? 'Too little data' : conf ? 'Confirmed' : 'Rejected',
      head: small ? 'Not enough fraud cases in this selection' : `Fraud rate sits between ${fmtPct(Math.min(...rates), 2)} and ${fmtPct(Math.max(...rates), 2)} across five score bands`,
      ev: `Chi-square ${ch.chi.toFixed(1)}, ${ch.df} d.f., ${fmtP(ch.p)}. ${conf ? 'No detectable difference.' : 'Bands differ.'}`, ch, rates }); }
  // (d) failure rates uniform across channels
  { const s = [], n = []; for (let k = 0; k < 6; k++) { s.push(FA(R, 'chan', k, M_S0 + 1)); n.push(FA(R, 'chan', k, M_CNT)); }
    const ch = chiHomog(s, n), rates = n.map((x, i) => rate(s[i], x)).filter((x, i) => n[i] > 0), small = ov.cnt < 500 || rates.length < 3;
    const conf = ch.p >= 0.01;
    out.push({ id: 'd', title: 'Failure rates are uniform across channels', verdict: small ? 'na' : conf ? 'ok' : 'no', label: small ? 'Too little data' : conf ? 'Confirmed' : 'Rejected',
      head: small ? 'Not enough transactions in this selection' : `Failed share ranges ${fmtPct(Math.min(...rates), 2)} to ${fmtPct(Math.max(...rates), 2)} across six channels`,
      ev: `Chi-square ${ch.chi.toFixed(1)}, ${ch.df} d.f., ${fmtP(ch.p)}. ${conf ? 'Differences are within chance.' : 'At least one channel stands out.'}`, ch, rates }); }
  return out;
}

/* ---------- insight engine ---------- */
function insights(R, C, cr) {
  const ov = R.ov, out = [], hy = hypotheses(R);
  if (!ov.cnt) return [];
  const lbl = (key, k) => DBY[key].labels[k];
  const cmpL = cr ? rangeText(cr[0], cr[1]) : null;
  // 1 growth
  { let cur = ov.val, prev = null, basis = '';
    if (C && cr) { prev = C.ov.val; basis = (S.cmp === 'yoy' ? 'the same period last year (' : 'the previous period (') + cmpL + ')'; }
    else if (S.b - S.a + 1 >= 730) { const e = S.b; cur = rsum(R.dVal, e - 364, e); prev = rsum(R.dVal, e - 729, e - 365); basis = 'the 12 months before (trailing 12 months to ' + dayLabel(e) + ')'; }
    if (prev) { const dv = safeDiv(cur - prev, prev), flat = Math.abs(dv) < 0.02;
      out.push({ id: 'growth', tag: flat ? 'Watch' : dv > 0 ? 'Opportunity' : 'Risk', imp: Math.abs(cur - prev), impNote: 'change in value',
        finding: `Transaction value is ${flat ? 'flat' : dv > 0 ? 'growing' : 'shrinking'}: ${fmtPctS(dv)} versus ${basis}`,
        evidence: `${fmtCr(cur)} against ${fmtCr(prev)}${C && cr ? `; transactions ${fmtPctS(safeDiv(ov.cnt - C.ov.cnt, C.ov.cnt))}, average ticket ${fmtPctS(safeDiv(safeDiv(ov.val, ov.cnt) - safeDiv(C.ov.val, C.ov.cnt), safeDiv(C.ov.val, C.ov.cnt)))}` : ''}.`,
        sowhat: flat ? 'The book is not compounding. Revenue that tracks volume will not rise without new products or pricing.' : dv > 0 ? 'Volume is expanding; fixed costs get leverage if risk and leakage stay flat.' : 'Volume is eroding; check which segments are losing share before it shows in revenue.',
        action: flat ? 'Set a growth target by segment and review pricing on the largest rails.' : dv > 0 ? 'Protect growth: invest in the segments driving it and keep fraud controls in step.' : 'Run a segment-level churn review and a win-back plan for top accounts.' }); } }
  // 2 fraud concentration at high ticket
  { const hi = { n: FA(R, 'ab', 4, M_CNT), f: FA(R, 'ab', 4, M_FN), fv: FA(R, 'ab', 4, M_FV) };
    if (hi.n > 0 && ov.fN > 0) { const h = hy[0], sh = safeDiv(hi.fv, ov.fV);
      out.push({ id: 'fraudhi', tag: h.rl && h.rh > 2 * h.rl ? 'Risk' : 'Watch', imp: hi.fv, impNote: 'fraud value above ₹10L',
        finding: `${fmtPct(sh, 0)} of fraud value comes from ${fmtPct(safeDiv(hi.n, ov.cnt), 1)} of transactions (those above ₹10L)`,
        evidence: `${fmtN(hi.f)} frauds above ₹10L worth ${fmtCr(hi.fv)}. Fraud rate ${fmtPct(h.rh, 2)} above ₹10L against ${fmtPct(h.rl, 2)} below${h.rl ? ' (' + (h.rh / h.rl).toFixed(1) + '×)' : ''}; ${fmtP(h.z.p)}.`,
        sowhat: 'Risk sits in a very small number of large payments. Controls aimed at every transaction are mostly spent on the wrong ones.',
        action: 'Add step-up authentication and a hold-and-call-back review for any payment above ₹10L.' }); } }
  // 3 RTGS / Cheque
  { const h = hy[1];
    if (h.verdict !== 'na') { const fv = FA(R, 'ttype', META.labels.ttype.indexOf('RTGS'), M_FV) + FA(R, 'ttype', META.labels.ttype.indexOf('Cheque'), M_FV);
      out.push({ id: 'rails', tag: h.verdict === 'no' ? 'Watch' : 'Risk', imp: fv, impNote: 'fraud value on RTGS + Cheque',
        finding: `RTGS and Cheque fraud rates are ${h.rd ? (h.rr / h.rd).toFixed(1) : '–'}× and ${h.rd ? (h.rc / h.rd).toFixed(1) : '–'}× the digital average`,
        evidence: `RTGS ${fmtPct(h.rr, 2)} (${fmtN(h.r.f)} of ${fmtN(h.r.n)}), Cheque ${fmtPct(h.rc, 2)} (${fmtN(h.c.f)} of ${fmtN(h.c.n)}), digital rails ${fmtPct(h.rd, 2)}.`,
        sowhat: 'High-value, low-friction rails are where fraud concentrates; instant digital rails are no worse than average.',
        action: 'Apply amount-based limits and beneficiary cooling-off on RTGS; move cheque clearing to positive-pay verification.' }); } }
  // 4 leakage
  { const s = [], n = []; for (let k = 0; k < 6; k++) { s.push(FA(R, 'chan', k, M_FRN)); n.push(FA(R, 'chan', k, M_CNT)); }
    const ch = chiHomog(s, n), rts = n.map((x, i) => rate(s[i], x)), hot = rts.indexOf(Math.max(...rts.filter((x, i) => n[i] > 0))), uniform = ch.p >= 0.01;
    out.push({ id: 'leak', tag: 'Risk', imp: ov.frV, impNote: 'failed + reversed value',
      finding: `${fmtPct(rate(ov.frN, ov.cnt), 1)} of transactions fail or reverse, ${fmtCr(ov.frV)} of value at risk`,
      evidence: `${fmtN(ov.frN)} failed or reversed, a further ${fmtN(ov.pendN)} pending. By channel the rate runs ${fmtPct(Math.min(...rts.filter((x, i) => n[i] > 0)), 2)} to ${fmtPct(Math.max(...rts), 2)}; ${fmtP(ch.p)}. ${uniform ? 'The channels are statistically alike.' : lbl('chan', hot) + ' is the hot spot.'}`,
      sowhat: uniform ? 'Leakage is systemic, not a single weak channel, so the cause sits in shared infrastructure, core banking or switch.' : 'One channel is leaking more than the rest, so the fix is local.',
      action: uniform ? 'Audit the shared payment switch and settlement path; set a bank-wide failure target.' : 'Fix ' + lbl('chan', hot) + ' first and track its failure rate weekly.' }); }
  // 5 KYC
  { const nv = FA(R, 'kyc', 1, M_VAL) + FA(R, 'kyc', 2, M_VAL), nvn = FA(R, 'kyc', 1, M_CNT) + FA(R, 'kyc', 2, M_CNT);
    if (nvn > 0) out.push({ id: 'kyc', tag: 'Risk', imp: ov.khbBal * 100 || nv, impNote: ov.khbBal ? 'peak balances of KYC-gap customers holding ≥ ₹10L' : 'value moved without verified KYC',
      finding: `${fmtPct(safeDiv(nv, ov.val), 1)} of value moves through accounts whose KYC is pending or expired`,
      evidence: `${fmtCr(nv)} across ${fmtN(nvn)} transactions. ${fmtN(ov.khbCust)} customers hold a balance of ₹10L or more with KYC pending or expired (peak balances total ${fmtCr(ov.khbBal * 100)}).`,
      sowhat: 'This is a regulatory exposure, not a loss yet. Large balances with lapsed KYC are what an RBI inspection samples first.',
      action: 'Run a 30-day KYC refresh on high-balance accounts and restrict outward limits until completed.' }); }
  // 6 EMI stress
  { const lc = R.stressC.reduce((a, b) => a + b, 0), hi = R.stressC[4] + R.stressC[3];
    if (lc > 0) out.push({ id: 'emi', tag: hi / lc > 0.15 ? 'Risk' : 'Watch', imp: R.stressE[3] + R.stressE[4], impNote: 'EMI on stressed accounts',
      finding: `${fmtPct(hi / lc, 0)} of loan transactions carry an EMI above 25% of the account balance`,
      evidence: `${fmtN(hi)} of ${fmtN(lc)} loan transactions. EMI book on those: ${fmtCr(R.stressE[3] + R.stressE[4])}; ${fmtN(R.stressC[4])} are above 50%.`,
      sowhat: 'Accounts where the instalment is a quarter of the balance have little buffer; missed EMIs show up here first.',
      action: 'Place these accounts on early-warning watch and offer restructuring before the next due date.' }); }
  // 7 concentration
  { const st = DBY.state.labels.map((l, k) => ({ k, v: FA(R, 'state', k, M_VAL) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    if (st.length >= 3) { const t3 = st.slice(0, 3).reduce((t, x) => t + x.v, 0), tc = R.top.reduce((t, x) => t + x.val, 0);
      out.push({ id: 'conc', tag: 'Watch', imp: t3, impNote: 'value in top 3 states', weight: 0.02,
        finding: `Three states carry ${fmtPct(t3 / ov.val, 0)} of value; the top 10 customers carry ${fmtPct(tc / ov.val, 1)}`,
        evidence: `${st.slice(0, 3).map(x => lbl('state', x.k)).join(', ')} lead. Customer concentration is ${tc / ov.val < 0.01 ? 'negligible' : 'low'}: no single name matters.`,
        sowhat: 'Geographic concentration is moderate; customer concentration is not a risk here.', action: 'Track state shares quarterly; target the bottom three states with a local acquisition plan.' }); } }
  // 8 digital shift
  { const bks = fillSeries(R, makeBuckets(S.a, S.b, 'month'));
    if (bks.length >= 6) { const sh = x => { const t = x.ttV.reduce((p, q) => p + q, 0); return t ? (x.ttV[0] + x.ttV[1]) / t : 0; };
      const k = Math.min(3, Math.floor(bks.length / 2)), early = mean(bks.slice(0, k).map(sh)), late = mean(bks.slice(-k).map(sh)), dd = late - early;
      out.push({ id: 'digital', tag: dd > 0.02 ? 'Opportunity' : 'Watch', imp: ov.val * Math.abs(dd), impNote: 'value that changed rail', weight: dd > 0.02 ? 1 : 0.1,
        finding: Math.abs(dd) < 0.02 ? `The payment mix is stable: instant digital rails hold about ${fmtPct(late, 0)} of value` : `Instant digital rails ${dd > 0 ? 'gained' : 'lost'} ${Math.abs(dd * 100).toFixed(1)} points of value share`,
        evidence: `UPI + IMPS: ${fmtPct(early, 1)} of value in the first ${k} months, ${fmtPct(late, 1)} in the last ${k}.`,
        sowhat: Math.abs(dd) < 0.02 ? 'There is no digital migration under way, so cost-to-serve is not falling by itself.' : 'Migration is lowering the share of costlier rails.',
        action: Math.abs(dd) < 0.02 ? 'Price or incentivise UPI over cheque and branch cash handling.' : 'Keep incentives that move volume to digital.' });
      // 9 anomalies + MoM movers
      const v = bks.map(x => x.val), m = mean(v), s = sd(v);
      const an = bks.map((x, i) => ({ x, z: s ? (v[i] - m) / s : 0 })).filter(o => Math.abs(o.z) > 2).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
      out.push({ id: 'anom', tag: 'Watch', imp: an.length ? Math.abs(an[0].x.val - m) : 0, impNote: 'deviation from monthly mean', weight: 0.1,
        finding: an.length ? `${an.length} month${an.length > 1 ? 's' : ''} deviate more than 2σ from the monthly average` : 'No month deviates more than 2σ: volumes are steady',
        evidence: an.length ? an.slice(0, 3).map(o => `${o.x.label} ${fmtCr(o.x.val)} (${o.z > 0 ? '+' : '−'}${Math.abs(o.z).toFixed(1)}σ)`).join('; ') + '.' : `Monthly value averages ${fmtCr(m)} with a standard deviation of ${fmtCr(s)} (${fmtPct(safeDiv(s, m), 1)}).`,
        sowhat: an.length ? 'These months need an explanation before the trend is trusted.' : 'The business is stable, which makes any future break easy to spot.', action: an.length ? 'Check campaigns, outages or reporting changes in those months.' : 'Set an alert at ±2σ on monthly value.' });
      if (bks.length >= 3) { let up = null, dn = null;
        for (let i = 1; i < bks.length; i++) { if (!bks[i - 1].val) continue; const ch = (bks[i].val - bks[i - 1].val) / bks[i - 1].val; if (!up || ch > up.ch) up = { ch, a: bks[i - 1], b: bks[i] }; if (!dn || ch < dn.ch) dn = { ch, a: bks[i - 1], b: bks[i] }; }
        if (up && dn) out.push({ id: 'mom', tag: 'Watch', imp: Math.max(Math.abs(up.b.val - up.a.val), Math.abs(dn.b.val - dn.a.val)), impNote: 'largest monthly swing', weight: 0.1,
          finding: `Biggest month-on-month moves: ${up.b.label} ${fmtPctS(up.ch)} and ${dn.b.label} ${fmtPctS(dn.ch)}`,
          evidence: `${up.a.label} ${fmtCr(up.a.val)} to ${up.b.label} ${fmtCr(up.b.val)}; ${dn.a.label} ${fmtCr(dn.a.val)} to ${dn.b.label} ${fmtCr(dn.b.val)}.`,
          sowhat: Math.max(Math.abs(up.ch), Math.abs(dn.ch)) < 0.1 ? 'Swings stay inside ±10%, which is normal noise for this book.' : 'Swings above 10% deserve a named cause.', action: 'Annotate these months in the monthly review.' }); } } }
  // 10 state fraud anomalies
  { const rows = DBY.state.labels.map((l, k) => ({ k, n: FA(R, 'state', k, M_CNT), f: FA(R, 'state', k, M_FN) })).filter(r => r.n >= 200);
    if (rows.length >= 4 && ov.fN >= 20) { const base = ov.fN / ov.cnt; const zs = rows.map(r => ({ r, z: (r.f / r.n - base) / Math.sqrt(base * (1 - base) / r.n) })).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
      const top = zs[0], flag = Math.abs(top.z) > 2;
      out.push({ id: 'statefraud', tag: flag ? 'Watch' : 'Watch', imp: flag ? FA(R, 'state', top.r.k, M_FV) : 0, impNote: 'fraud value in outlier state', weight: 0.5,
        finding: flag ? `${lbl('state', top.r.k)} fraud rate is ${top.z > 0 ? 'above' : 'below'} the national rate by ${Math.abs(top.z).toFixed(1)}σ` : 'No state has a fraud rate more than 2σ from the national rate',
        evidence: flag ? `${lbl('state', top.r.k)} ${fmtPct(top.r.f / top.r.n, 2)} against ${fmtPct(base, 2)} overall.` : `State fraud rates range ${fmtPct(Math.min(...rows.map(r => r.f / r.n)), 2)} to ${fmtPct(Math.max(...rows.map(r => r.f / r.n)), 2)}, consistent with chance.`,
        sowhat: flag ? 'A regional pattern is worth a targeted review.' : 'Fraud is not a regional problem, so regional controls would not help.', action: flag ? 'Review merchant and device patterns in that state.' : 'Keep controls national and amount-driven.' }); } }
  // 11 time of day
  { const s = [], n = []; for (let h = 0; h < 24; h++) { s.push(FA(R, 'hour', h, M_FN)); n.push(FA(R, 'hour', h, M_CNT)); }
    if (ov.fN >= 50) { const ch = chiHomog(s, n), flat = ch.p >= 0.01; const rts = n.map((x, i) => rate(s[i], x)); const pk = rts.indexOf(Math.max(...rts));
      out.push({ id: 'hour', tag: 'Watch', imp: flat ? 0 : FA(R, 'hour', pk, M_FV), impNote: 'fraud value at peak hour', weight: 0.5,
        finding: flat ? 'Fraud shows no time-of-day pattern' : `Fraud peaks at ${String(pk).padStart(2, '0')}:00`,
        evidence: `Chi-square across 24 hours: ${ch.chi.toFixed(1)}, ${fmtP(ch.p)}. Hourly fraud rate ranges ${fmtPct(Math.min(...rts.filter((x, i) => n[i] > 0)), 2)} to ${fmtPct(Math.max(...rts), 2)}.`,
        sowhat: flat ? 'Night-time blocking rules would hurt customers without catching more fraud.' : 'Time-based rules would add signal.', action: flat ? 'Do not add hour-of-day rules.' : 'Tighten step-up checks around the peak hour.' }); } }
  out.forEach(o => { o.score = o.imp * (o.weight == null ? 1 : o.weight); });
  out.sort((a, b) => b.score - a.score);
  out.hyp = hy;
  return out;
}
