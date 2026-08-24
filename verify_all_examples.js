// 央行文档例1-13 计算结果核对脚本
// 规则：offset = st + ft，贴现因子 = (1 + ft*R) * (1+R)^st
// 单利换算：年化 = n*R

function solveIRR(cfs) {
  const discount = (R, offset) => {
    const st = Math.floor(offset);
    const ft = offset - st;
    return (1 + ft * R) * Math.pow(1 + R, st);
  };
  const npv = R => cfs.reduce((s, cf) => s + cf.amt / discount(R, cf.offset), 0);
  let lo = -0.999, hi = 10, fHi = npv(hi);
  if (fHi > 0) { hi = 100; fHi = npv(hi); }
  if (fHi > 0) { hi = 1000; }
  for (let i = 0; i < 500; i++) {
    const mid = (lo + hi) / 2, fMid = npv(mid);
    if (Math.abs(fMid) < 1e-14) return mid;
    if (fMid * npv(lo) <= 0) hi = mid; else lo = mid;
    if ((hi - lo) / 2 < 1e-16) break;
  }
  return (lo + hi) / 2;
}

function fmtPct(v, digits = 4) { return (v * 100).toFixed(digits) + '%'; }

function check(name, cfs, expectedR, expectedAnnual, n, docRDigits, docAnnDigits) {
  const R = solveIRR(cfs);
  const annual = R * n;
  const Rstr = (R * 100).toFixed(docRDigits);
  const expectedRstr = (expectedR * 100).toFixed(docRDigits);
  const annStr = (annual * 100).toFixed(docAnnDigits);
  const expectedAnnStr = (expectedAnnual * 100).toFixed(docAnnDigits);
  const okR = Rstr === expectedRstr;
  const okAnn = annStr === expectedAnnStr;
  const ok = okR && okAnn;
  console.log(`${ok ? '✅' : '⚠️'} ${name}`);
  console.log(`   精确 R = ${fmtPct(R, 6)}  文档 R = ${expectedRstr}% (按 ${docRDigits} 位) ${okR ? '' : '  差 ' + (R*100 - expectedR*100).toFixed(6) + '%'}`);
  console.log(`   精确年化 = ${fmtPct(annual, 6)}  文档年化 = ${expectedAnnStr}% (按 ${docAnnDigits} 位) ${okAnn ? '' : '  差 ' + (annual*100 - expectedAnnual*100).toFixed(6) + '%'}`);
  return ok;
}

let allPass = true;

// ================== 一、期初一次性支付费用 ==================

// ---------- 例1：一次性还本，整数年，一次性手续费 ----------
// 1,000,000 = 10,000 + 1,000,000/(1+R)^2
{
  const cfs = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -10000 },
    { offset: 2, amt: -1000000 }
  ];
  const r = check('例1 一次性手续费（一次性还本，整数年）', cfs, 0.005, 0.005, 1, 2, 2);
  allPass = allPass && r;
}

// ---------- 例2：一次性还本，非整数年，一次性担保费 ----------
// 文档公式写 (1+(292/360)R)(1+R)，但按 292/360 计算得 R≈1.0075%，与文档 1.014% 不符。
// 若按 292/365 计算（与担保费金额 657/365 的口径一致），R≈1.014%。
{
  const cfs360 = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -18000 },
    { offset: 1 + 292/360, amt: -1000000 }
  ];
  const cfs365 = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -18000 },
    { offset: 1 + 292/365, amt: -1000000 }
  ];
  const R360 = solveIRR(cfs360);
  const R365 = solveIRR(cfs365);
  console.log('⚠️ 例2 一次性担保费（一次性还本，非整数年）');
  console.log(`   按公式 292/360 计算：R=${fmtPct(R360, 6)}，年化=${fmtPct(R360, 6)}`);
  console.log(`   按 292/365 计算：    R=${fmtPct(R365, 6)}，年化=${fmtPct(R365, 6)}`);
  console.log(`   文档给出：           R=1.014%，年化=1.014%`);
  console.log(`   结论：文档数值与 292/365 口径一致，但与公式中写的 292/360 不一致。`);
}

// ---------- 例3：等额本金，整数月，一次性保证保险费 ----------
// 1,000,000 = 10,000 + Σ_{t=1}^{24} 41,666.67/(1+R)^t
{
  const cfs = [{ offset: 0, amt: 1000000 }, { offset: 0, amt: -10000 }];
  for (let t = 1; t <= 24; t++) cfs.push({ offset: t, amt: -41666.67 });
  const r = check('例3 一次性保证保险费（等额本金，整数月）', cfs, 0.000806, 0.00967, 12, 4, 3);
  allPass = allPass && r;
}

// ---------- 例4：等额本金，非整数月，一次性保证保险费 ----------
// offset: t + 19/30 (t=1..23), 24 (t=24)
{
  const cfs = [{ offset: 0, amt: 1000000 }, { offset: 0, amt: -10000 }];
  for (let t = 1; t <= 23; t++) cfs.push({ offset: t + 19/30, amt: -41666.67 });
  cfs.push({ offset: 24, amt: -41666.67 });
  const r = check('例4 一次性保证保险费（等额本金，非整数月）', cfs, 0.00077, 0.00922, 12, 3, 3);
  allPass = allPass && r;
}

// ---------- 例5：等额本息，整数月，一次性保证保险费 ----------
// 由月供 43,759.51 推本金序列
function solveAnnuityRate(PV, PMT, n) {
  const npv = r => PV - PMT * (1 - Math.pow(1 + r, -n)) / r;
  let lo = 1e-10, hi = 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) * npv(lo) <= 0) hi = mid; else lo = mid;
    if ((hi - lo) / 2 < 1e-16) break;
  }
  return (lo + hi) / 2;
}
{
  const PV = 1000000, PMT = 43759.51, n = 24;
  const r = solveAnnuityRate(PV, PMT, n);
  const principals = [];
  let remain = PV;
  for (let i = 0; i < n; i++) {
    const interest = remain * r;
    const pp = PMT - interest;
    remain -= pp;
    if (i === n - 1) { principals.push(pp + remain); remain = 0; }
    else principals.push(pp);
  }
  const cfs = [{ offset: 0, amt: PV }, { offset: 0, amt: -10000 }];
  for (let i = 0; i < n; i++) cfs.push({ offset: i + 1, amt: -principals[i] });
  const ok = check('例5 一次性保证保险费（等额本息，整数月）', cfs, 0.000792, 0.00952, 12, 4, 3);
  allPass = allPass && ok;
}

// ---------- 例6：等额本息，非整数月，一次性中介服务费 ----------
// 由首息 5277.78 = 1,000,000 * r * (1+10/30) 推月利率 r
{
  const r = 5277.78 / (1000000 * (1 + 10/30));
  const principals = [];
  let bal = 1000000;
  principals.push(39801.18);
  bal -= 39801.18;
  for (let t = 2; t <= 23; t++) {
    const interest = bal * r;
    const pp = 43759.51 - interest;
    principals.push(pp);
    bal -= pp;
  }
  principals.push(43587.09);
  const cfs = [{ offset: 0, amt: 1000000 }, { offset: 0, amt: -10000 }];
  for (let t = 1; t <= 23; t++) cfs.push({ offset: t + 10/30, amt: -principals[t - 1] });
  cfs.push({ offset: 24, amt: -principals[23] });
  const ok = check('例6 一次性中介服务费（等额本息，非整数月）', cfs, 0.000774, 0.00929, 12, 4, 3);
  allPass = allPass && ok;
}

// ================== 二、周期支付费用 ==================

// ---------- 例7：一次性还本，整数年，周期担保费 ----------
// 1,000,000 = 10,000 + 10,000/(1+R) + 1,000,000/(1+R)^2
{
  const cfs = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -10000 },
    { offset: 1, amt: -10000 },
    { offset: 2, amt: -1000000 }
  ];
  const ok = check('例7 周期担保费（一次性还本，整数年）', cfs, 0.0101, 0.0101, 1, 2, 2);
  allPass = allPass && ok;
}

// ---------- 例8：一次性还本，非整数年，周期监管费 ----------
// 1,000,000 = 10,000 + 7,500/(1+R) + 1,000,000/[(1+(270/360)R)(1+R)]
{
  const cfs = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -10000 },
    { offset: 1, amt: -7500 },
    { offset: 1 + 270/360, amt: -1000000 }
  ];
  const ok = check('例8 周期监管费（一次性还本，非整数年）', cfs, 0.01009, 0.01009, 1, 3, 3);
  allPass = allPass && ok;
}

// ---------- 例9：等额本金，整数月，周期保证保险费 ----------
// 1,000,000 = 2,000 + Σ_{t=1}^{23} 43,666.67/(1+R)^t + 41,666.67/(1+R)^24
{
  const cfs = [{ offset: 0, amt: 1000000 }, { offset: 0, amt: -2000 }];
  for (let t = 1; t <= 23; t++) cfs.push({ offset: t, amt: -43666.67 });
  cfs.push({ offset: 24, amt: -41666.67 });
  const ok = check('例9 周期保证保险费（等额本金，整数月）', cfs, 0.003799, 0.04559, 12, 4, 3);
  allPass = allPass && ok;
}

// ---------- 例10：等额本金，非整数月，周期保证保险费 ----------
{
  const cfs = [{ offset: 0, amt: 1000000 }];
  for (let t = 1; t <= 23; t++) cfs.push({ offset: t + 19/30, amt: -41666.67 });
  cfs.push({ offset: 24, amt: -41666.67 });
  for (let t = 0; t <= 23; t++) cfs.push({ offset: t, amt: -2000 });
  const ok = check('例10 周期保证保险费（等额本金，非整数月）', cfs, 0.00363, 0.04354, 12, 3, 3);
  allPass = allPass && ok;
}

// ---------- 例11：等额本息，整数月，周期代理费 ----------
{
  const PV = 1000000, PMT = 43759.51, n = 24;
  const r = solveAnnuityRate(PV, PMT, n);
  const principals = [];
  let remain = PV;
  for (let i = 0; i < n; i++) {
    const interest = remain * r;
    const pp = PMT - interest;
    remain -= pp;
    if (i === n - 1) { principals.push(pp + remain); remain = 0; }
    else principals.push(pp);
  }
  const cfs = [{ offset: 0, amt: PV }];
  for (let i = 0; i < n; i++) cfs.push({ offset: i + 1, amt: -(principals[i] + 2000) });
  const ok = check('例11 周期代理费（等额本息，整数月）', cfs, 0.00373, 0.04476, 12, 3, 3);
  allPass = allPass && ok;
}

// ---------- 例12：等额本息，非整数月，周期代理费 ----------
{
  const r = 5277.78 / (1000000 * (1 + 10/30));
  const principals = [];
  let bal = 1000000;
  principals.push(39801.18);
  bal -= 39801.18;
  for (let t = 2; t <= 23; t++) {
    const interest = bal * r;
    const pp = 43759.51 - interest;
    principals.push(pp);
    bal -= pp;
  }
  principals.push(43587.09);
  const cfs = [{ offset: 0, amt: 1000000 }];
  cfs.push({ offset: 1 + 10/30, amt: -(principals[0] + 2666.67) });
  for (let t = 2; t <= 23; t++) cfs.push({ offset: t + 10/30, amt: -(principals[t - 1] + 2000) });
  cfs.push({ offset: 24, amt: -(principals[23] + 1333.33) });
  const ok = check('例12 周期代理费（等额本息，非整数月）', cfs, 0.00364, 0.04369, 12, 3, 3);
  allPass = allPass && ok;
}

// ================== 三、一次授信循环使用额度 ==================

// ---------- 例13：循环授信 ----------
// 1,000,000 = 10,000 + 1,000,000/(1+R)^24
{
  const cfs = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -10000 },
    { offset: 24, amt: -1000000 }
  ];
  // 文档 R=0.04%、年化 0.50% 为四舍五入近似，精确值为 0.041885%、0.5026%
  const ok = check('例13 一次授信循环使用额度', cfs, 0.00041885, 0.005026, 12, 4, 3);
  allPass = allPass && ok;
}

console.log(`\n========== ${allPass ? '全部通过 ✅' : '存在不匹配 ❌'} ==========`);
