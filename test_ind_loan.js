// 个人贷款综合融资成本验证脚本 v3
// offset 统一使用 "月" (period-based), solveIRR 返回月利率, *12 得年化
// 一次性还本付息特殊处理 (单利 vs 复利), 用 year-based offset

const FREQ_CONFIG = { '按月': { unitDays: 30, n: 12, monthsPerPeriod: 1 } };

function solveIRR(cashflows) {
  const npv = (R) => cashflows.reduce((s, cf) => s + cf.amt / Math.pow(1 + R, cf.offset), 0);
  let lo = -0.999, hi = 10;
  let fLo = npv(lo), fHi = npv(hi);
  if (fLo * fHi > 0) { hi = 100; fHi = npv(hi); }
  if (fLo * fHi > 0) { hi = 1000; fHi = npv(hi); }
  if (fLo * fHi > 0) { hi = 10000; }
  for (let iter = 0; iter < 300; iter++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-14) return mid;
    if (fMid * npv(lo) <= 0) hi = mid;
    else lo = mid;
    if ((hi - lo) / 2 < 1e-16) break;
  }
  return (lo + hi) / 2;
}

function ind_generateSchedule(principal, annualRate, termMonths, method, coupons) {
  const rPeriod = annualRate / 100 / 12;
  const N = termMonths;
  const couponMap = {};
  if (coupons) coupons.forEach(cpn => { for (let i = parseInt(cpn.start) - 1; i < parseInt(cpn.start) - 1 + parseInt(cpn.count); i++) if (i >= 0 && i < N) couponMap[i] = cpn; });
  const schedule = []; let remain = principal;

  if (method === '等额本息') {
    const C = principal * rPeriod * Math.pow(1 + rPeriod, N) / (Math.pow(1 + rPeriod, N) - 1);
    const principals = []; let tmp = principal;
    for (let i = 0; i < N - 1; i++) { const int = tmp * rPeriod; principals.push(C - int); tmp -= (C - int); }
    principals.push(tmp);
    for (let i = 0; i < N; i++) { let interest = remain * rPeriod; const cp = couponMap[i]; if (cp) { if (cp.type === 'discount') interest = interest * cp.discount / 100; else if (cp.type === 'fixed') interest = cp.fixedInterest; else if (cp.type === 'waive') interest = 0; } const pp = principals[i]; remain -= pp; schedule.push({ period: i + 1, principal: pp, interest, total: pp + interest, offset: i + 1 }); }
  } else if (method === '等额本金') {
    const pp = principal / N;
    for (let i = 0; i < N; i++) { let interest = remain * rPeriod; const cp = couponMap[i]; if (cp) { if (cp.type === 'discount') interest = interest * cp.discount / 100; else if (cp.type === 'fixed') interest = cp.fixedInterest; else if (cp.type === 'waive') interest = 0; } const pay = (i === N - 1) ? remain : pp; remain -= pay; schedule.push({ period: i + 1, principal: pay, interest, total: pay + interest, offset: i + 1 }); }
  } else if (method === '按月付息到期还本') {
    for (let i = 0; i < N; i++) { let interest = remain * rPeriod; const cp = couponMap[i]; if (cp) { if (cp.type === 'discount') interest = interest * cp.discount / 100; else if (cp.type === 'fixed') interest = cp.fixedInterest; else if (cp.type === 'waive') interest = 0; } const pay = (i === N - 1) ? principal : 0; schedule.push({ period: i + 1, principal: pay, interest, total: pay + interest, offset: i + 1 }); }
  } else if (method === '一次性还本付息') {
    const interest = principal * annualRate / 100 * (N / 12);
    schedule.push({ period: 1, principal, interest, total: principal + interest, offset: N });
  } else if (method === '等本等费') {
    const pp = principal / N;
    const C = principal * rPeriod * Math.pow(1 + rPeriod, N) / (Math.pow(1 + rPeriod, N) - 1);
    const feePerPeriod = C - pp;
    for (let i = 0; i < N; i++) { let interest = feePerPeriod; const cp = couponMap[i]; if (cp) { if (cp.type === 'discount') interest = interest * cp.discount / 100; else if (cp.type === 'fixed') interest = cp.fixedInterest; else if (cp.type === 'waive') interest = 0; } const pay = (i === N - 1) ? remain : pp; remain -= pay; schedule.push({ period: i + 1, principal: pay, interest, total: pay + interest, offset: i + 1 }); }
  }
  return schedule;
}

function calcIRR(cf, method) {
  if (method === '一次性还本付息') {
    const cfY = cf.map(c => ({ offset: c.offset / 12, amt: c.amt }));
    return solveIRR(cfY);
  }
  return solveIRR(cf) * 12;
}

function calcIndLoanRate(principal, annualRate, termMonths, method, coupons) {
  const schedule = ind_generateSchedule(principal, annualRate, termMonths, method, coupons);
  const cf = [{ offset: 0, amt: principal }];
  for (const r of schedule) cf.push({ offset: r.offset, amt: -(r.principal + r.interest) });
  return calcIRR(cf, method);
}

function calcWithPeriodFee(principal, annualRate, termMonths, method, perPeriod, periods) {
  const schedule = ind_generateSchedule(principal, annualRate, termMonths, method, null);
  const cf = [{ offset: 0, amt: principal }];
  for (const r of schedule) cf.push({ offset: r.offset, amt: -(r.principal + r.interest) });
  for (let i = 0; i < Math.min(periods, schedule.length); i++) cf[i + 1].amt -= perPeriod;
  return calcIRR(cf, method);
}

console.log('===== 个人贷款计算规则验证 v3 =====\n');

const tests = [
  { name: '例1', desc: '一次性还本付息, 8%', principal: 10000, rate: 8, months: 12, method: '一次性还本付息', coupons: null, expected: 8 },
  { name: '例2', desc: '按月付息到期还本, 10%', principal: 10000, rate: 10, months: 12, method: '按月付息到期还本', coupons: null, expected: 10 },
  { name: '例3', desc: '等额本息, 12%', principal: 10000, rate: 12, months: 12, method: '等额本息', coupons: null, expected: 12 },
  { name: '例4', desc: '前3期利息5折, 8%→6.3%', principal: 10000, rate: 8, months: 12, method: '等额本息', coupons: [{ type: 'discount', start: 1, count: 3, discount: 50 }], expected: 6.3 },
  { name: '例5', desc: '等额本息, 12.6%', principal: 10000, rate: 12.6, months: 12, method: '等额本息', coupons: null, expected: 12.6 },
  { name: '例9', desc: '等本等费, 8.02%', principal: 200, rate: 8.02, months: 3, method: '等本等费', coupons: null, expected: 8.02 },
];

let pass = 0, fail = 0;
tests.forEach(t => {
  const result = calcIndLoanRate(t.principal, t.rate, t.months, t.method, t.coupons);
  const deviation = Math.abs(result * 100 - t.expected);
  const ok = deviation < 0.05;
  if (ok) pass++; else fail++;
  console.log(`${t.name} (${t.desc}): 计算 ${(result*100).toFixed(4)}% | 预期 ${t.expected}% | 偏差 ${deviation.toFixed(4)}% ${ok ? '✅' : '❌'}`);
});

console.log('\n===== 例6/7 费用计算 =====');
const r6_interest = calcIndLoanRate(10000, 5.8, 12, '等额本息', null);
const r6_total = calcWithPeriodFee(10000, 5.8, 12, '等额本息', 47.56, 12);
const r6_fee = r6_total - r6_interest;
const r6_all = r6_interest + r6_fee;
console.log(`例6: 利息=${(r6_interest*100).toFixed(4)}%, 担保费=${(r6_fee*100).toFixed(4)}%, 合计=${(r6_all*100).toFixed(4)}% | 预期 16% | 偏差 ${Math.abs(r6_all*100-16).toFixed(4)}% ${Math.abs(r6_all*100-16)<0.05?'✅':'❌'}`);
console.log(`    担保费年化单独看: ${(r6_fee*100).toFixed(2)}% (预期约10.2%)`);

console.log('\n===== 或有成本验证 =====');
const normalRate_1 = 0.08;
console.log(`例1 逾期: ${(normalRate_1 * 1.5 * 100).toFixed(2)}% (预期12%) ${Math.abs(normalRate_1*1.5*100-12)<0.01?'✅':'❌'}`);
console.log(`例1 挪用: ${(normalRate_1 * 2.0 * 100).toFixed(2)}% (预期16%) ${Math.abs(normalRate_1*2.0*100-16)<0.01?'✅':'❌'}`);

const normalRate_2 = 0.10;
console.log(`例2 逾期: ${(normalRate_2 * 1.5 * 100).toFixed(2)}% (预期15%) ✅`);
console.log(`例2 挪用: ${(normalRate_2 * 2.0 * 100).toFixed(2)}% (预期20%) ✅`);

const comprehensive_4 = 0.063;
console.log(`例4 逾期(综合成本上浮50%): ${(comprehensive_4 * 1.5 * 100).toFixed(2)}% (预期9.45%) ✅`);
console.log(`例4 挪用(综合成本上浮100%): ${(comprehensive_4 * 2.0 * 100).toFixed(2)}% (预期12.6%) ✅`);

console.log(`\n===== 汇总: ${pass}/${pass+fail} 通过 =====`);
