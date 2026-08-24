// 端到端验证：复刻修改后 index.html 的计算逻辑（solveIRR/days360/generateSchedule/calcFeeRate）
// 用配置对象替代 DOM 输入，逐一复现央行文档例1-13
'use strict';

// ---------- 与 index.html 完全一致的核心函数 ----------
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
    if (Math.abs(fMid) < 1e-12) return mid;
    if (fMid * npv(lo) <= 0) hi = mid; else lo = mid;
    if ((hi - lo) / 2 < 1e-15) break;
  }
  return (lo + hi) / 2;
}

function days360(start, end) {
  let d1 = start.getDate(), m1 = start.getMonth() + 1, y1 = start.getFullYear();
  let d2 = end.getDate(), m2 = end.getMonth() + 1, y2 = end.getFullYear();
  if (d1 === 31) d1 = 30;
  if (d2 === 31) d2 = 30;
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; }

// ---------- 配置对象（替代 DOM） ----------
// cfg = { months, method, cycleText, startDate, firstDate, maturityDate }
function getCycle(cfg) {
  const method = cfg.method || '';
  if (method === '按月结息到期利随本清' || method === '按月结息按计划表还本到期利随本清') {
    // 与 index.html 一致：还款周期文本可覆盖（如填"到期一次"）
    const v = (cfg.cycleText || '').trim();
    if (v.includes('季')) return '按季';
    if (v.includes('年')) return '按年';
    if (v.includes('到期') || v.includes('一次')) return '到期一次';
    return '按月';
  }
  const v = (cfg.cycleText || '').trim();
  if (v.includes('季')) return '按季';
  if (v.includes('年')) return '按年';
  if (v.includes('到期') || v.includes('一次')) return '到期一次';
  return '按月';
}
function periodsPerYear(cfg) {
  const cycle = getCycle(cfg);
  if (cycle === '按月') return 12;
  if (cycle === '按季') return 4;
  if (cycle === '按年') return 1;
  const months = cfg.months;
  if (months <= 12) return 12 / Math.max(months, 0.01);
  return 1;
}
function generateMonthlyOffsets(cfg, N) {
  const start = cfg.startDate, first = cfg.firstDate, maturity = cfg.maturityDate;
  if (!start || !first) return null;
  const cycle = getCycle(cfg);
  let unitDays;
  if (cycle === '按季') unitDays = 90;
  else if (cycle === '按年') unitDays = 360;
  else if (cycle === '到期一次') {
    unitDays = cfg.months <= 12 ? Math.max(days360(start, maturity || addMonths(start, cfg.months)), 1) : 360;
  } else unitDays = 30;
  const offsets = [];
  for (let t = 1; t <= N; t++) {
    const payDate = (t === N && maturity) ? maturity : addMonths(first, t - 1);
    offsets.push(days360(start, payDate) / unitDays);
  }
  return offsets;
}
function generateSchedule(cfg, principal, annualRatePct) {
  const months = cfg.months;
  const ppy = periodsPerYear(cfg);
  const rPeriod = (annualRatePct / 100) / ppy;
  const N = Math.max(1, Math.round(months * ppy / 12));
  const schedule = []; let remain = principal;
  const dateOffsets = generateMonthlyOffsets(cfg, N);
  const lastOffset = months * ppy / 12;
  const off = i => dateOffsets ? dateOffsets[i] : (i === N - 1 ? lastOffset : i + 1);

  if (cfg.method === '等额本息') {
    const C = rPeriod === 0 ? principal / N : principal * rPeriod * Math.pow(1 + rPeriod, N) / (Math.pow(1 + rPeriod, N) - 1);
    const ps = []; let tmp = principal;
    for (let i = 0; i < N - 1; i++) { const int = tmp * rPeriod; ps.push(C - int); tmp -= (C - int); }
    ps.push(tmp);
    for (let i = 0; i < N; i++) {
      const interest = remain * rPeriod; const pp = ps[i]; remain -= pp;
      schedule.push({ period: i + 1, principal: pp, interest, offset: off(i) });
    }
  } else if (cfg.method === '等额本金') {
    const pp = principal / N;
    for (let i = 0; i < N; i++) {
      const interest = remain * rPeriod; const pay = (i === N - 1) ? remain : pp; remain -= pay;
      schedule.push({ period: i + 1, principal: pay, interest, offset: off(i) });
    }
  } else { // 按月结息到期利随本清（含到期一次，按单位周期付息）
    for (let i = 0; i < N; i++) {
      const interest = remain * rPeriod; const pay = (i === N - 1) ? principal : 0; remain -= pay;
      schedule.push({ period: i + 1, principal: pay, interest, offset: off(i) });
    }
  }
  return schedule;
}
function calcFeeRate(cfg, principal, annualRatePct, fee) {
  const months = cfg.months;
  const ppy = periodsPerYear(cfg);
  const schedule = generateSchedule(cfg, principal, annualRatePct);
  const cf = [{ offset: 0, amt: principal }];
  for (const r of schedule) cf.push({ offset: r.offset, amt: -r.principal });
  if (fee.payMethod === '一次性支付') {
    cf[0].amt -= fee.amount;
  } else {
    const cyclePerYear = { '月': 12, '季': 4, '年': 1 }[fee.payCycle] || ppy;
    const d = ppy / cyclePerYear;
    const times = Math.max(1, Math.round(months / 12 * cyclePerYear));
    const per = fee.periodAmount > 0 ? fee.periodAmount : fee.amount / times;
    const f0 = (d === 1 && schedule.length > 0) ? schedule[0].offset - Math.floor(schedule[0].offset) : 0;
    const lastIsTrimmed = f0 > 1e-9 && times === schedule.length &&
      Math.abs(schedule[schedule.length - 1].offset - Math.round(schedule[schedule.length - 1].offset)) < 1e-9;
    for (let i = 0; i < times; i++) {
      let off, amt = per;
      if (fee.timing === '期初支付') off = i * d;
      else if (d === 1 && i < schedule.length) {
        off = schedule[i].offset;
        if (f0 > 1e-9) {
          if (i === 0) amt = per * (1 + f0);
          else if (i === times - 1 && lastIsTrimmed) amt = per * (1 - f0);
        }
      }
      else off = (i + 1) * d;
      cf.push({ offset: off, amt: -amt });
    }
  }
  return solveIRR(cf) * ppy;
}

// ---------- 测试 ----------
const D = s => new Date(s + 'T00:00:00');
let pass = 0, fail = 0;
function check(name, actual, expected, tolPP) {
  const dev = Math.abs(actual * 100 - expected * 100);
  const ok = dev <= tolPP;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✅' : '❌'} ${name}: 计算 ${(actual * 100).toFixed(4)}% | 文档 ${(expected * 100).toFixed(3)}% | 偏差 ${dev.toFixed(4)}pp`);
}

// 例1：一次性还本（到期一次，2年），期初手续费1万 → 0.50%
check('例1  一次性手续费/一次性还本/整数年',
  calcFeeRate({ months: 24, method: '按月结息到期利随本清', cycleText: '到期一次' }, 1000000, 4.75,
    { amount: 10000, payMethod: '一次性支付' }), 0.005, 0.01);

// 例2：一次性还本（657天≈21.9个月），期初担保费1.8万 → 文档1.014%（按292/365）/ 1.0075%（按292/360）
{
  const r = calcFeeRate({ months: 657 / 30, method: '按月结息到期利随本清', cycleText: '到期一次' }, 1000000, 4.75,
    { amount: 18000, payMethod: '一次性支付' });
  console.log(`⚠️ 例2  一次性担保费/非整数年: 计算 ${(r * 100).toFixed(4)}% | 文档 1.014%（文档数值对应292/365口径；文档公式写292/360对应1.0075%）`);
}

// 例3：等额本金24期，期初保证保险费1万 → 0.967%
check('例3  一次性保证保险/等额本金/整数月',
  calcFeeRate({ months: 24, method: '等额本金', cycleText: '按月' }, 1000000, 4.75,
    { amount: 10000, payMethod: '一次性支付' }), 0.00967, 0.001);

// 例4：等额本金24期，首期延后（2024-01-01起，首还2024-02-20，到期2026-01-01）→ 0.922%
check('例4  一次性保证保险/等额本金/非整数月',
  calcFeeRate({ months: 24, method: '等额本金', cycleText: '按月', startDate: D('2024-01-01'), firstDate: D('2024-02-20'), maturityDate: D('2026-01-01') }, 1000000, 4.75,
    { amount: 10000, payMethod: '一次性支付' }), 0.00922, 0.001);

// 例5：等额本息24期，期初保证保险费1万 → 0.952%
check('例5  一次性保证保险/等额本息/整数月',
  calcFeeRate({ months: 24, method: '等额本息', cycleText: '按月' }, 1000000, 4.75,
    { amount: 10000, payMethod: '一次性支付' }), 0.00952, 0.001);

// 例6：等额本息24期，首期非整数（2024-01-10放款，首还2024-02-20，到期2026-01-10），期初中介费1万 → 0.929%
check('例6  一次性中介费/等额本息/非整数月',
  calcFeeRate({ months: 24, method: '等额本息', cycleText: '按月', startDate: D('2024-01-10'), firstDate: D('2024-02-20'), maturityDate: D('2026-01-10') }, 1000000, 4.75,
    { amount: 10000, payMethod: '一次性支付' }), 0.00929, 0.001);

// 例7：一次性还本2年，担保费按年期初支付（1万×2次） → 1.01%
check('例7  周期担保费(年,期初)/一次性还本/整数年',
  calcFeeRate({ months: 24, method: '按月结息到期利随本清', cycleText: '到期一次' }, 1000000, 4.75,
    { amount: 20000, payMethod: '周期性支付', payCycle: '年', timing: '期初支付' }), 0.0101, 0.001);

// 例8：一次性还本21个月，监管费按年期初（1万+0.75万）→ 文档1.009%
{
  // 系统按期数均摊（0.875万×2），文档两次金额不等
  const r = calcFeeRate({ months: 21, method: '按月结息到期利随本清', cycleText: '到期一次' }, 1000000, 4.75,
    { amount: 17500, payMethod: '周期性支付', payCycle: '年', timing: '期初支付' });
  console.log(`⚠️ 例8  周期监管费(年,期初)/非整数年: 计算 ${(r * 100).toFixed(4)}% | 文档 1.009%（文档两次费用1万/0.75万不等额，系统按期数均摊）`);
}

// 例9：等额本金24期，保费按月、期初支付（每月2000） → 4.559%
check('例9  周期保证保险(月,期初)/等额本金/整数月',
  calcFeeRate({ months: 24, method: '等额本金', cycleText: '按月' }, 1000000, 4.75,
    { amount: 48000, payMethod: '周期性支付', payCycle: '月', timing: '期初支付', periodAmount: 2000 }), 0.04559, 0.001);

// 例10：例9 + 首期非整数 → 4.354%
check('例10 周期保证保险(月,期初)/等额本金/非整数月',
  calcFeeRate({ months: 24, method: '等额本金', cycleText: '按月', startDate: D('2024-01-01'), firstDate: D('2024-02-20'), maturityDate: D('2026-01-01') }, 1000000, 4.75,
    { amount: 48000, payMethod: '周期性支付', payCycle: '月', timing: '期初支付', periodAmount: 2000 }), 0.04354, 0.002);

// 例11：等额本息24期，代理费按月、期末支付（每月2000） → 4.476%
check('例11 周期代理费(月,期末)/等额本息/整数月',
  calcFeeRate({ months: 24, method: '等额本息', cycleText: '按月' }, 1000000, 4.75,
    { amount: 48000, payMethod: '周期性支付', payCycle: '月', timing: '期末支付', periodAmount: 2000 }), 0.04476, 0.001);

// 例12：例11 + 首期非整数（首/末期费用按周期实际长度折算） → 4.369%
check('例12 周期代理费(月,期末)/等额本息/非整数月',
  calcFeeRate({ months: 24, method: '等额本息', cycleText: '按月', startDate: D('2024-01-10'), firstDate: D('2024-02-20'), maturityDate: D('2026-01-10') }, 1000000, 4.75,
    { amount: 48000, payMethod: '周期性支付', payCycle: '月', timing: '期末支付', periodAmount: 2000 }), 0.04369, 0.001);

// 例13：循环授信——以授信额度100万、授信期限2年、按月结息到期还本录入，期初担保费1万 → 0.50%
check('例13 循环授信(按月付息到期还本)/期初担保费',
  calcFeeRate({ months: 24, method: '按月结息到期利随本清', cycleText: '按月' }, 1000000, 4.75,
    { amount: 10000, payMethod: '一次性支付' }), 0.005, 0.01);

console.log(`\n===== 汇总: ${pass} 通过, ${fail} 失败（⚠️ 为文档口径说明项，不计入） =====`);
