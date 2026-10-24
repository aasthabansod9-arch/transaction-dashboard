'use strict';
/* ================= core: constants, formats, data, filters, aggregation ================= */
const META = JSON.parse(document.getElementById('meta').textContent);
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const MS = 86400000, EPOCH = Date.UTC(2019, 0, 1), NDAYS = 1827;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const dayDate = d => new Date(EPOCH + d * MS);
const dateToDay = (y, m, d) => Math.round((Date.UTC(y, m, d) - EPOCH) / MS);
const iso = d => dayDate(d).toISOString().slice(0, 10);
const isoToDay = s => { const p = s.split('-').map(Number); return dateToDay(p[0], p[1] - 1, p[2]); };
const dayLabel = d => { const t = dayDate(d); return String(t.getUTCDate()).padStart(2, '0') + ' ' + MON[t.getUTCMonth()] + ' ' + t.getUTCFullYear(); };
const LAST_FULL_DAY = isoToDay('2023-12-31'), STUB_DAY = isoToDay('2024-01-01');

/* ---------- formats (rupees; amounts are held in paise, 1 Cr = 1e9 paise) ---------- */
const nf = new Intl.NumberFormat('en-IN');
function fmtCr(p, signed) {
  if (!p) return '₹0 Cr';
  const cr = p / 1e9, a = Math.abs(cr);
  const dp = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 2 : 3;
  const s = new Intl.NumberFormat('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(a);
  return (cr < 0 ? '−' : signed && cr > 0 ? '+' : '') + '₹' + s + ' Cr';
}
const fmtInr = r => '₹' + nf.format(Math.round(r));
const fmtN = n => nf.format(Math.round(n));
const fmtPct = (x, dp) => (x * 100).toFixed(dp == null ? 1 : dp) + '%';
const fmtPctS = (x, dp) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(dp == null ? 1 : dp) + '%';
const safeDiv = (a, b) => (b ? a / b : 0);
/* metric formatters: val & cnt & avg */
const MET = {
  val: { name: 'Value', short: 'Value', get: (c, v) => v, fmt: x => fmtCr(x) },
  cnt: { name: 'Count', short: 'Count', get: (c, v) => c, fmt: x => fmtN(x) },
  avg: { name: 'Avg ticket', short: 'Avg ticket', get: (c, v) => safeDiv(v, c) / 100, fmt: x => fmtInr(x) }
};

/* ---------- display names ---------- */
const pretty = s => String(s).replace(/_/g, ' ');
const LOANNAME = { None: 'No loan', Unclassified: 'Loan, type not recorded' };
const STATENAME = { UP: 'Uttar Pradesh' };

/* ---------- data load ---------- */
let D = null, N = 0;
async function loadData() {
  const b64 = document.getElementById('pack').textContent.trim();
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  let raw;
  if (typeof DecompressionStream !== 'undefined') {
    const st = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    raw = new Uint8Array(await new Response(st).arrayBuffer());
  } else {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    raw = pako.inflateRaw(u8);
  }
  N = META.n; D = {};
  let off = 0;
  const TA = { uint8: Uint8Array, uint16: Uint16Array, uint32: Uint32Array };
  for (const [name, dt, sz] of META.cols) {
    const out = new TA[dt](N), o8 = new Uint8Array(out.buffer);
    for (let p = 0; p < sz; p++) { const base = off + p * N; for (let i = 0; i < N; i++) o8[i * sz + p] = raw[base + i]; }
    off += N * sz; D[name] = out;
  }
}

/* ---------- derived columns + calendar tables ---------- */
let dYear, dQ, dMon, DAYSTR;
const SB_LABELS = ['300–549', '550–649', '650–749', '750–799', '800–899'];
const SB_NAMES = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const AB_LABELS = ['< ₹1K', '₹1K–10K', '₹10K–1L', '₹1L–10L', '> ₹10L'];
const AB_EDGES_PAISE = [1e5, 1e6, 1e7, 1e8];
const GROUP_OF = { UPI: 0, IMPS: 0, NEFT: 1, RTGS: 1, Net_Banking: 1, POS: 2, Credit_Card: 2, Auto_Debit: 2, ATM_Withdrawal: 3, Cheque: 3 };
const GROUPS = ['Instant digital (UPI, IMPS)', 'Bank transfers (NEFT, RTGS, Net Banking)', 'Cards & auto-pay (POS, Credit Card, Auto Debit)', 'Cash & paper (ATM, Cheque)'];
const DIGITAL_TYPES = ['UPI', 'IMPS', 'NEFT', 'Net_Banking', 'POS', 'Credit_Card', 'Auto_Debit'];
const NB = 700;
let DIMS = [], DBY = {}, ND = 0, BITS = {};
function prepare() {
  dYear = new Uint16Array(NDAYS); dQ = new Uint8Array(NDAYS); dMon = new Uint8Array(NDAYS);
  for (let d = 0; d < NDAYS; d++) { const t = dayDate(d), y = t.getUTCFullYear(), m = t.getUTCMonth(); dYear[d] = y; dMon[d] = (y - 2019) * 12 + m; dQ[d] = (y - 2019) * 4 + Math.floor(m / 3); }
  D.wd = new Uint8Array(N); D.sb = new Uint8Array(N); D.ab = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    D.wd[i] = (D.day[i] + 1) % 7;
    const s = D.score[i]; D.sb[i] = s < 550 ? 0 : s < 650 ? 1 : s < 750 ? 2 : s < 800 ? 3 : 4;
    const a = D.amt[i]; D.ab[i] = a < 1e5 ? 0 : a < 1e6 ? 1 : a < 1e7 ? 2 : a < 1e8 ? 3 : 4;
  }
  const L = META.labels;
  const nice = (arr, map) => arr.map(x => (map && map[x]) || pretty(x));
  DIMS = [
    { key: 'state', title: 'State', arr: D.state, labels: nice(L.state, STATENAME) },
    { key: 'acct', title: 'Account type', arr: D.acct, labels: nice(L.acct) },
    { key: 'ttype', title: 'Transaction type', arr: D.ttype, labels: nice(L.ttype) },
    { key: 'chan', title: 'Channel', arr: D.chan, labels: nice(L.chan) },
    { key: 'merch', title: 'Merchant category', arr: D.merch, labels: nice(L.merch) },
    { key: 'loan', title: 'Loan type', arr: D.loan, labels: nice(L.loan, LOANNAME) },
    { key: 'kyc', title: 'KYC status', arr: D.kyc, labels: nice(L.kyc) },
    { key: 'status', title: 'Transaction status', arr: D.status, labels: nice(L.status) },
    { key: 'sb', title: 'Credit score band', arr: D.sb, labels: SB_LABELS.map((l, i) => l + ' ' + SB_NAMES[i]) },
    { key: 'ab', title: 'Amount bucket', arr: D.ab, labels: AB_LABELS },
    { key: 'fraud', title: 'Fraud flag', arr: D.fraud, labels: ['Legitimate', 'Fraud'] },
    { key: 'hour', title: 'Hour of day', arr: D.hour, labels: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00') },
    { key: 'wd', title: 'Weekday', arr: D.wd, labels: WD }
  ];
  ND = DIMS.length;
  DIMS.forEach((d, j) => { d.j = j; d.bit = 1 << j; d.k = d.labels.length; DBY[d.key] = d; BITS[d.key] = d.bit; });
}

/* ---------- state ---------- */
const S = {
  F: {}, a: isoToDay('2023-01-01'), b: LAST_FULL_DAY, cmp: 'yoy', metric: 'val', grain: 'auto', mix: 'group', tables: {}
};
const DEFAULT = { a: isoToDay('2023-01-01'), b: LAST_FULL_DAY };
let fail;
function initFilters() { DIMS.forEach(d => S.F[d.key] = new Set()); fail = new Uint16Array(N); }
function computeFail() {
  fail.fill(0);
  for (const d of DIMS) {
    const set = S.F[d.key]; if (!set.size) continue;
    const ok = new Uint8Array(d.k); set.forEach(v => ok[v] = 1);
    const arr = d.arr, bit = d.bit;
    for (let i = 0; i < N; i++) if (!ok[arr[i]]) fail[i] |= bit;
  }
}
function lowerBound(x) { let l = 0, h = N; while (l < h) { const m = (l + h) >> 1; if (D.day[m] < x) l = m + 1; else h = m; } return l; }
function cmpRange(a, b, mode) {
  if (mode === 'prev') { const len = b - a + 1, ca = a - len; return ca >= 0 ? [ca, a - 1] : null; }
  const da = dayDate(a), db = dayDate(b);
  const ca = dateToDay(da.getUTCFullYear() - 1, da.getUTCMonth(), da.getUTCDate());
  const cb = dateToDay(db.getUTCFullYear() - 1, db.getUTCMonth(), db.getUTCDate());
  return ca >= 0 ? [ca, cb] : null;
}

/* ---------- aggregation ---------- */
const NM = 13; // per-dimension measures
const M_CNT = 0, M_VAL = 1, M_CRED = 2, M_FN = 3, M_FV = 4, M_FRN = 5, M_FRV = 6, M_LN = 7, M_EMI = 8, M_S0 = 9; // S0..S3 = status counts
let NC = 0, SCR = null;
function scratch() {
  if (SCR) return SCR;
  let mx = 0; for (let i = 0; i < N; i++) if (D.cust[i] > mx) mx = D.cust[i];
  NC = mx + 1;
  SCR = {
    seen: new Uint8Array(NC), cl: new Uint8Array(NC), ck: new Uint8Array(NC),
    lastD: new Int32Array(NC), lastM: new Int32Array(NC),
    cVal: new Float64Array(NC), cN: new Uint32Array(NC), cF: new Uint32Array(NC), cFV: new Float64Array(NC), cK: new Uint32Array(NC), khb: new Uint32Array(NC)
  };
  return SCR;
}
function aggregate(lo, hi, light) {
  const sc = scratch();
  sc.seen.fill(0); sc.cl.fill(0); sc.ck.fill(0); sc.lastD.fill(-1); sc.lastM.fill(-1);
  if (!light) { sc.cVal.fill(0); sc.cN.fill(0); sc.cF.fill(0); sc.cFV.fill(0); sc.cK.fill(0); sc.khb.fill(0); }
  const R = {
    lo, hi,
    ov: { cnt: 0, val: 0, cred: 0, fN: 0, fV: 0, frN: 0, frV: 0, pendN: 0, lnN: 0, emi: 0, cust: 0, khbN: 0, khbVal: 0, khbCust: 0, khbBal: 0 },
    dCnt: new Float64Array(NDAYS), dVal: new Float64Array(NDAYS), dCred: new Float64Array(NDAYS), dFN: new Float64Array(NDAYS), dFV: new Float64Array(NDAYS), dFR: new Float64Array(NDAYS), dFRV: new Float64Array(NDAYS), dCust: new Float64Array(NDAYS),
    mCust: new Float64Array(64),
    dTTv: new Float64Array(NDAYS * 10), dTTc: new Float64Array(NDAYS * 10),
    base: DIMS.map(d => new Float64Array(d.k * NM)), extra: DIMS.map(d => new Float64Array(d.k * NM)),
    heatC: new Float64Array(168), heatF: new Float64Array(168),
    hist: new Float64Array(NB), histAcct: new Float64Array(5 * NB),
    custLoan: null, custKyc: null,
    stressC: new Float64Array(5), stressE: new Float64Array(5),
    top: []
  };
  const { day, cust, amt, bal, emi } = D;
  const A_ST = D.status, A_DIR = D.dir, A_FR = D.fraud, A_LOAN = D.loan, A_KYC = D.kyc, A_TT = D.ttype, A_AC = D.acct, A_HR = D.hour, A_WD = D.wd;
  const arrs = DIMS.map(d => d.arr);
  const HWBITS = BITS.hour | BITS.wd, HWNOT = (~HWBITS) & 0xffff;
  const BIT_ACCT = BITS.acct, BIT_LOAN = BITS.loan, BIT_KYC = BITS.kyc;
  const DBIT = new Int8Array(1 << ND).fill(-1); DIMS.forEach(d => DBIT[d.bit] = d.j);
  const ov = R.ov, base = R.base, extra = R.extra, hc = R.heatC, hf = R.heatF;
  const { seen, cl, ck, lastD, lastM, cVal, cN, cF, cFV, cK, khb } = sc;
  function add(A, k, v, isC, fr, st, frs, ln, e) {
    const o = k * NM;
    A[o]++; A[o + 1] += v;
    if (isC) A[o + 2] += v;
    if (fr) { A[o + 3]++; A[o + 4] += v; }
    if (frs) { A[o + 5]++; A[o + 6] += v; }
    if (ln) { A[o + 7]++; A[o + 8] += e; }
    A[o + 9 + st]++;
  }
  for (let i = lo; i < hi; i++) {
    const f = fail[i];
    if ((f & HWNOT) === 0) { const c = A_HR[i] * 7 + A_WD[i]; hc[c]++; if (A_FR[i]) hf[c]++; }
    if (f !== 0 && (f & (f - 1)) !== 0) continue;
    const v = amt[i], isC = A_DIR[i] === 0, fr = A_FR[i], st = A_ST[i], frs = (st === 1 || st === 2) ? 1 : 0, lnv = A_LOAN[i], ln = lnv > 0 ? 1 : 0, e = emi[i], c = cust[i];
    if (f === 0) {
      const d = day[i], mm = dMon[d];
      ov.cnt++; ov.val += v; if (isC) ov.cred += v;
      if (fr) { ov.fN++; ov.fV += v; }
      if (frs) { ov.frN++; ov.frV += v; }
      if (st === 3) ov.pendN++;
      if (ln) { ov.lnN++; ov.emi += e; }
      R.dCnt[d]++; R.dVal[d] += v; if (isC) R.dCred[d] += v;
      if (fr) { R.dFN[d]++; R.dFV[d] += v; }
      if (frs) { R.dFR[d]++; R.dFRV[d] += v; }
      const ti = d * 10 + A_TT[i]; R.dTTv[ti] += v; R.dTTc[ti]++;
      if (!seen[c]) { seen[c] = 1; ov.cust++; }
      if (lastD[c] !== d) { lastD[c] = d; R.dCust[d]++; }
      if (lastM[c] !== mm) { lastM[c] = mm; R.mCust[mm]++; }
      cl[c] |= 1 << lnv; ck[c] |= 1 << A_KYC[i];
      const bin = Math.min(NB - 1, Math.max(0, Math.floor(Math.log10(v / 100) * 100)));
      R.hist[bin]++; R.histAcct[A_AC[i] * NB + bin]++;
      if (ln) { const r = e / 100 / bal[i]; const b5 = r < 0.05 ? 0 : r < 0.10 ? 1 : r < 0.25 ? 2 : r < 0.5 ? 3 : 4; R.stressC[b5]++; R.stressE[b5] += e; }
      if (A_KYC[i] !== 0 && bal[i] >= 1000000) {
        ov.khbN++; ov.khbVal += v; const old = khb[c];
        if (old === 0) ov.khbCust++;
        if (bal[i] > old) { ov.khbBal += bal[i] - old; khb[c] = bal[i]; }
      }
      if (!light) { cVal[c] += v; cN[c]++; if (fr) { cF[c]++; cFV[c] += v; } if (A_KYC[i] !== 0) cK[c]++; }
      for (let j = 0; j < ND; j++) add(base[j], arrs[j][i], v, isC, fr, st, frs, ln, e);
    } else {
      const j = DBIT[f];
      add(extra[j], arrs[j][i], v, isC, fr, st, frs, ln, e);
      if (f === BIT_ACCT) { const bin = Math.min(NB - 1, Math.max(0, Math.floor(Math.log10(v / 100) * 100))); R.histAcct[A_AC[i] * NB + bin]++; }
      else if (f === BIT_LOAN) cl[c] |= 1 << lnv;
      else if (f === BIT_KYC) ck[c] |= 1 << A_KYC[i];
    }
  }
  R.cross = R.base.map((b, j) => { const e = R.extra[j], o = new Float64Array(b.length); for (let q = 0; q < b.length; q++) o[q] = b[q] + e[q]; return o; });
  R.full = R.base;
  // distinct customers per loan / kyc category (cross semantics)
  R.custLoan = new Float64Array(8); R.custKyc = new Float64Array(3);
  for (let c = 0; c < NC; c++) {
    const a = cl[c]; if (a) for (let q = 0; q < 8; q++) if (a & (1 << q)) R.custLoan[q]++;
    const b = ck[c]; if (b) for (let q = 0; q < 3; q++) if (b & (1 << q)) R.custKyc[q]++;
  }
  if (!light) {
    const top = [];
    for (let c = 0; c < NC; c++) {
      if (!cN[c]) continue;
      const v = cVal[c];
      if (top.length < 10 || v > top[top.length - 1].val) {
        top.push({ id: c, val: v, n: cN[c], fN: cF[c], fV: cFV[c], kN: cK[c] });
        top.sort((x, y) => y.val - x.val); if (top.length > 10) top.pop();
      }
    }
    R.top = top;
  }
  return R;
}
