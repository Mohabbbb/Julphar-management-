/* Import planner (Imp, src/import_plan.js) — tests at its interface: Imp.plan and the value parsers.
   Locks today's V43/V44 behaviour before any refactor. Expected values are worked by hand
   (ADOL 500MG CAPL RSP 5.05 SAR from the live data copy; TX0501 = Adwaa Nimar, 2026-10-01, 500 boxes). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Eng = require('../src/engine.js');
const Imp = require('../src/import_plan.js');

const TODAY = '2026-10-11';
const ADOL = 'ADOL 500MG CAPL[2X12BL]SA-PVT';

function liveCopy() {
  const root = path.join(__dirname, 'fixture'), docs = {};
  for (const c of fs.readdirSync(root))
    for (const f of fs.readdirSync(path.join(root, c)))
      docs[c + '/' + f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(root, c, f)));
  return docs;
}
const docs = liveCopy();
const ctx = Eng.ctx(docs, TODAY);
const deals = Object.keys(docs).filter(k => k.startsWith('deals/')).flatMap(k => docs[k].rows);

/* the order builder's pricing, as the app passes it in (opts.price); here a fixed 50% standard rule */
const standard50 = () => ({ pct: 0.5, src: 'Standard rule' });

function planOrders(lines, opts) {
  const rows = [['Date', 'Account', 'Item', 'Qty', 'Discount %'], ...lines];
  const hdr = Imp.detectHeader(rows, 'orders');
  return Imp.plan('orders', rows, hdr, ctx, Object.assign({ today: TODAY, eng: Eng, price: standard50 }, opts));
}

test.describe('Order import (Imp.plan orders)', () => {
  test('a new order line is ready and priced through the injected price rule', () => {
    const r = planOrders([['2026-10-05', 'Adwaa Nimar', ADOL, 100, '']]).rows[0];
    assert.equal(r.status, 'ready');
    assert.equal(r.data.status, 'Executed');
    assert.equal(r.data.src, 'Standard rule');
    assert.equal(r.data.net, 252.5);                    // 100 × 5.05 × (1 − 0.5)
  });

  test('a line identical to a saved order is flagged as a duplicate of that order', () => {
    const r = planOrders([['2026-10-01', 'Adwaa Nimar', ADOL, 500, '']]).rows[0];
    assert.equal(r.status, 'duplicate');
    assert.match(r.msg, /TX0501/);
  });

  test('the same line twice in one file: the second is a duplicate of the first row', () => {
    const p = planOrders([['2026-10-05', 'Adwaa Nimar', ADOL, 7, ''], ['2026-10-05', 'Adwaa Nimar', ADOL, 7, '']]);
    assert.deepEqual(p.rows.map(r => r.status), ['ready', 'duplicate']);
    assert.match(p.rows[1].msg, /Same as row 2/);
  });

  test('an unknown account is a problem, never guessed', () => {
    const r = planOrders([['2026-10-05', 'Nobody Pharmacy', ADOL, 10, '']]).rows[0];
    assert.equal(r.status, 'problem');
    assert.equal(r.msg, 'Unknown account');
  });

  test('an unsigned 1 as discount asks 1% or 100%', () => {
    const r = planOrders([['2026-10-05', 'Adwaa Nimar', ADOL, 10, '1']]).rows[0];
    assert.equal(r.status, 'problem');
    assert.equal(r.msg, 'Is 1 meant as 1% or 100%? Write 1% or 100%');
  });

  test('a written discount overrides the price rule', () => {
    const r = planOrders([['2026-10-05', 'Adwaa Nimar', ADOL, 20, '1%']]).rows[0];
    assert.equal(r.status, 'ready');
    assert.equal(r.data.src, 'Imported discount');
    assert.equal(r.data.net, 99.99);                    // 20 × 5.05 × 0.99
  });

  test('no price rule means REVIEW, never a zero price', () => {
    const r = planOrders([['2026-10-05', 'Adwaa Nimar', ADOL, 10, '']], { price: () => null }).rows[0];
    assert.equal(r.status, 'problem');
    assert.equal(r.msg, 'No price rule (REVIEW)');
  });

  test('an Executed order dated after today is refused', () => {
    const r = planOrders([['2026-10-12', 'Adwaa Nimar', ADOL, 10, '']]).rows[0];
    assert.equal(r.status, 'problem');
    assert.equal(r.msg, 'Executed order is dated in the future');
  });

  test('blank rows are skipped and counted', () => {
    const p = planOrders([['', '', '', '', ''], ['2026-10-05', 'Adwaa Nimar', ADOL, 3, '']]);
    assert.equal(p.counts.skip, 1);
    assert.equal(p.counts.ready, 1);
  });
});

test.describe('Deal import (Imp.plan deals)', () => {
  test('the same account and item twice in one file is flagged, not applied twice', () => {
    const rows = [['Account', 'Item', 'Discount %'], ['Adwaa Nimar', ADOL, '40%'], ['Adwaa Nimar', ADOL, '45%']];
    const p = Imp.plan('deals', rows, Imp.detectHeader(rows, 'deals'), ctx, { today: TODAY, eng: Eng, deals });
    assert.ok(p.rows.every(r => r.status === 'problem'), JSON.stringify(p.rows.map(r => [r.status, r.msg])));
    assert.ok(p.rows.every(r => /Appears twice/.test(r.msg)));
  });

  test('an unsigned 1 as a deal discount asks 1% or 100%', () => {
    const rows = [['Account', 'Item', 'Discount %'], ['Adwaa Nimar', ADOL, 1]];
    const r = Imp.plan('deals', rows, Imp.detectHeader(rows, 'deals'), ctx, { today: TODAY, eng: Eng, deals }).rows[0];
    assert.equal(r.status, 'problem');
    assert.equal(r.msg, 'Is 1 meant as 1% or 100%? Write 1% or 100%');
  });

  test('the import refuses to plan deals without the existing deals', () => {
    const rows = [['Account', 'Item', 'Discount %'], ['Adwaa Nimar', ADOL, '40%']];
    assert.equal(Imp.plan('deals', rows, Imp.detectHeader(rows, 'deals'), ctx, {}).error, 'Existing deals were not supplied');
  });
});

test.describe('Value parsing', () => {
  test('discounts: whole numbers are percent, fractions are fractions, 1% is one percent', () => {
    assert.equal(Imp.pct('50'), 0.5);
    assert.equal(Imp.pct('0.5'), 0.5);
    assert.equal(Imp.pct('1%'), 0.01);
    assert.equal(Imp.pct('150'), undefined);
    assert.equal(Imp.pct(''), null);
  });

  test('dates: day/month/year text and Excel serial numbers', () => {
    assert.equal(Imp.date('02/10/2026'), '2026-10-02');
    assert.equal(Imp.date(46297), '2026-10-02');
    assert.equal(Imp.date('2026-10-02'), '2026-10-02');
    assert.equal(Imp.date('31/02/2026'), undefined);
    assert.equal(Imp.date('-'), null);
  });

  test('numbers: thousands separators and decimals', () => {
    assert.equal(Imp.num('1,200'), 1200);
    assert.equal(Imp.num('1.25'), 1.25);
    assert.equal(Imp.num(''), null);
  });
});

/* F5: the preview computes the same net the New order screen does (qty × (RSP × (1 − discount)), same multiplication order) and rounds it with the same rule, Eng.money,
   also at half-cent ties; the value that is SAVED (netExact) is untouched. */
test.describe('Order import preview rounding matches New order', () => {
  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });   // how the app's SAR() shows a number
  const screen = (qty, rsp, pct) => { const nu = rsp * (1 - pct); return Eng.money(qty * nu); };       // New order: nu = ref*(1-pct); nv = money(qty*nu) (G2: the saved line's net)
  const items = ctx.items.filter(i => i.active !== false && typeof i.rsp === 'number' && i.rsp > 0);
  test('preview net equals the New order net for every item at many quantities and discounts', () => {
    const lines = [], want = [];
    for (const it of items) for (const q of [1, 3, 7, 10, 25, 50, 125, 333]) for (const p of [0.33, 0.35, 0.4, 0.55]) {
      lines.push(['2026-10-05', 'Aster Chain', it.name, q, p * 100]); want.push([q, it.rsp, p]);
    }
    const plan = planOrders(lines).rows;
    let bad = [];
    plan.forEach((r, i) => {
      if (r.status !== 'ready' && r.status !== 'duplicate') return;
      const [q, rsp, p] = want[i], exp = screen(q, rsp, p);
      if (r.data.net !== exp || fmt(r.data.net) !== fmt(exp)) bad.push(q + ' x ' + rsp + ' @' + p + ' preview ' + fmt(r.data.net) + ' screen ' + fmt(exp));
    });
    assert.equal(bad.length, 0, bad.length + ' mismatches, e.g. ' + bad.slice(0, 3).join('; '));
  });
  test('the value that is saved (netExact) is unchanged: qty × (RSP × (1 − discount))', () => {
    const it = items[0], r = planOrders([['2026-10-05', 'Aster Chain', it.name, 7, 33]]).rows[0];
    assert.equal(r.data.netExact, 7 * (it.rsp * (1 - r.data.pct)));
    assert.equal(r.data.net, Number(r.data.net.toFixed(2)));
  });
  test('the 499 saved fixture lines still add up to 721,249.04', () => {
    let n = 0, c = 0;
    Object.keys(docs).filter(k => k.startsWith('orders/')).forEach(k => docs[k].rows.forEach(r => { if (r.status === 'Executed') { n += r.net; c++; } }));
    assert.equal(c, 499); assert.equal(n.toFixed(2), '721249.04');
  });
});

test.describe('Order import prices by the row date (G1)', () => {
  test('the price rule is asked for each row\'s own date', () => {
    const seen = [];
    planOrders([['2026-03-01', 'Adwaa Nimar', ADOL, 5, ''], ['2026-10-05', 'Adwaa Nimar', ADOL, 6, '']], { price: (a, i, day) => { seen.push(day); return { pct: 0.5, src: 'Standard rule' }; } });
    assert.deepEqual(seen, ['2026-03-01', '2026-10-05']);
  });
});
