// 央行文档例7-13 计算结果核对脚本
// 规则：offset = st + ft，贴现因子 = (1 + ft*R) * (1+R)^st

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

function check(name, cfs, expectedR, expectedAnnual, periodsPerYear = 12, toleranceR = 5e-6, toleranceAnn = 5e-5) {
  const R = solveIRR(cfs);
  const annual = R * periodsPerYear;
  const diffR = Math.abs(R - expectedR);
  const diffAnn = Math.abs(annual - expectedAnnual);
  const ok = diffR <= toleranceR && diffAnn <= toleranceAnn;
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  console.log(`   计算 R = ${fmtPct(R, 6)}  期望 R = ${fmtPct(expectedR, 6)}  差值 = ${(diffR*100).toFixed(6)}%`);
  console.log(`   计算年化 = ${fmtPct(annual, 4)}  期望年化 = ${fmtPct(expectedAnnual, 4)}  差值 = ${(diffAnn*100).toFixed(4)}%`);
  if (!ok) {
    console.log('   现金流:', JSON.stringify(cfs.map(c => ({ offset: c.offset, amt: c.amt }))));
  }
  return ok;
}

// ---------- 例7：一次性还本，周期担保费（整数年） ----------
// 1,000,000 = 10,000 + 10,000/(1+R) + 1,000,000/(1+R)^2
{
  const cfs = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -10000 },
    { offset: 1, amt: -10000 },
    { offset: 2, amt: -1000000 }
  ];
  check('例7 周期担保费（整数年）', cfs, 0.0101, 0.0101, 1);
}

// ---------- 例8：一次性还本，周期监管费（非整数年） ----------
// 1,000,000 = 10,000 + 7,500/(1+R) + 1,000,000/[(1+(270/360)R)(1+R)]
{
  const cfs = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -10000 },
    { offset: 1, amt: -7500 },
    { offset: 1 + 270/360, amt: -1000000 }
  ];
  check('例8 周期监管费（非整数年）', cfs, 0.01009, 0.01009, 1);
}

// ---------- 例9：等额本金，周期保证保险费（整数月） ----------
// 1,000,000 = 2,000 + Σ_{t=1}^{23} 43,666.67/(1+R)^t + 41,666.67/(1+R)^24
{
  const cfs = [{ offset: 0, amt: 1000000 }, { offset: 0, amt: -2000 }];
  for (let t = 1; t <= 23; t++) cfs.push({ offset: t, amt: -43666.67 });
  cfs.push({ offset: 24, amt: -41666.67 });
  check('例9 等额本金周期保证保险费（整数月）', cfs, 0.003799, 0.04559, 12);
}

// ---------- 例10：等额本金，周期保证保险费（非整数月） ----------
// offset: t + 19/30 (t=1..23), 24 (t=24)
// 1,000,000 = Σ_{t=1}^{23} 41,666.67/[(1+(19/30)R)(1+R)^t] + 41,666.67/(1+R)^24
//             + Σ_{t=0}^{23} 2,000/(1+R)^t
{
  const cfs = [{ offset: 0, amt: 1000000 }];
  for (let t = 1; t <= 23; t++) cfs.push({ offset: t + 19/30, amt: -41666.67 });
  cfs.push({ offset: 24, amt: -41666.67 });
  for (let t = 0; t <= 23; t++) cfs.push({ offset: t, amt: -2000 });
  check('例10 等额本金周期保证保险费（非整数月）', cfs, 0.00363, 0.04354, 12);
}

// ---------- 例11：等额本息，周期代理费（整数月） ----------
// 先由月供 43,759.51 反推本金序列
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
  const sumP = principals.reduce((a, b) => a + b, 0);
  console.log(`   [例11 推导] 月供隐含月利率 r=${fmtPct(r, 6)}, 本金合计=${sumP.toFixed(2)}`);
  const cfs = [{ offset: 0, amt: PV }];
  for (let i = 0; i < n; i++) cfs.push({ offset: i + 1, amt: -(principals[i] + 2000) });
  check('例11 等额本息周期代理费（整数月）', cfs, 0.00373, 0.04476, 12);
}

// ---------- 例12：等额本息，周期代理费（非整数月） ----------
// 放款日 2024-01-10，首次还款 2024-02-20，周期 1+10/30 个月，末次还款 2026-01-10（offset=24）
// 由首息 5277.78 = 1,000,000 * r * (1+10/30) 推月利率 r；再生成本金序列
{
  const r = 5277.78 / (1000000 * (1 + 10/30));
  const principals = [];
  let bal = 1000000;
  // 第1期
  principals.push(39801.18);
  bal -= 39801.18;
  // 第2-23期：等额本息固定月供 43759.51
  for (let t = 2; t <= 23; t++) {
    const interest = bal * r;
    const pp = 43759.51 - interest;
    principals.push(pp);
    bal -= pp;
  }
  // 第24期：本金 43587.09
  principals.push(43587.09);
  const sumP = principals.reduce((a, b) => a + b, 0);
  console.log(`   [例12 推导] 月利率 r=${fmtPct(r, 6)}, 本金合计=${sumP.toFixed(2)}`);
  const cfs = [{ offset: 0, amt: 1000000 }];
  cfs.push({ offset: 1 + 10/30, amt: -(principals[0] + 2666.67) });
  for (let t = 2; t <= 23; t++) cfs.push({ offset: t + 10/30, amt: -(principals[t - 1] + 2000) });
  cfs.push({ offset: 24, amt: -(principals[23] + 1333.33) });
  check('例12 等额本息周期代理费（非整数月）', cfs, 0.00364, 0.04369, 12);
}

// ---------- 例13：一次授信循环使用额度 ----------
// 1,000,000 = 10,000 + 1,000,000/(1+R)^24
{
  const cfs = [
    { offset: 0, amt: 1000000 },
    { offset: 0, amt: -10000 },
    { offset: 24, amt: -1000000 }
  ];
  // 文档给出 R=0.04%、年化 0.50% 为四舍五入后的近似值；精确值为 0.041885%、0.5026%
  check('例13 一次授信循环使用额度（精确值）', cfs, 0.00041885, 0.005026, 12, 1e-6, 1e-5);
}

console.log('\n核对完成。');
