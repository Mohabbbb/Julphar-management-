/* Seams 1 and 2 of docs/spec-stock-from-orders.md: Eng.acctStock (1a) and Eng.predictions (1b).
   Every expected number below is worked out by hand in the comment next to it (or taken from the spec /
   the golden file). Nothing here re-implements the estimate formula.
   Run: node --test t/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Eng = require('../src/engine.js');

const TODAY = '2026-10-11';
const FIXTURE = path.join(__dirname, 'fixture');
const GOLDEN = path.join(__dirname, 'golden', 'predictions_2026-10-11.json');
const ESTIMATE_FIELDS = ['lastQty', 'interval', 'dailyUse', 'estOnHand', 'runOutDate', 'coverDays'];

/* ---------- synthetic data, shaped like t/fixture ---------- */
const ITEMS = [
  { id: 'I1', name: 'ADOL TEST CAPL', active: true, rsp: 4, std: 0.5 },
  { id: 'I2', name: 'BUTALIN TEST SYR', active: true, rsp: 4, std: 0.5 },
  { id: 'I3', name: 'CELER TEST TAB', active: true, rsp: 4, std: 0.5 },
];
let lineNo = 0;
/* one order line; net unit price 2 SAR unless given */
function line(account, itemId, date, qty, extra) {
  lineNo++;
  const it = ITEMS.find((i) => i.id === itemId);
  return Object.assign({
    id: 'TX' + String(lineNo).padStart(4, '0'), date, account, itemId, item: it.name,
    qty, net: qty * 2, netUnit: 2, status: 'Executed', source: 'Photo order (test)',
  }, extra || {});
}
/* docs map {"collection/docId": body} from accounts, order lines and optional stock moves */
function docs(accountNames, lines, moves) {
  const d = {
    'master/settings': { app: 'Julphar Sales Platform', schema: 1 },
    'master/accounts': { rows: accountNames.map((n, i) => ({ id: 'ACC' + (i + 1), name: n, active: true, type: 'Pharmacy' })) },
    'master/items': { rows: ITEMS },
  };
  for (const l of lines) {
    const p = 'orders/' + l.date.slice(0, 7);
    (d[p] = d[p] || { rows: [], schema: 1 }).rows.push(l);
  }
  if (moves && moves.length) d['stock/2026-10'] = { rows: moves, schema: 1 };
  return d;
}
function row(ctx, account, itemId) {
  const r = Eng.acctStock(ctx, account).rows.find((x) => x.itemId === itemId);
  assert.ok(r, 'no Account stock row for ' + account + ' x ' + itemId);
  return r;
}
function pred(ctx, account, itemId) {
  return Eng.predictions(ctx).rows.find((p) => p.account === account && p.itemId === itemId);
}

/* Spec worked example: last order 2026-10-01, 300 units, usual gap 30 days.
   Two orders 30 days apart (2026-09-01 -> 2026-10-01) give the item interval 30. */
function workedExample(extraLines, moves) {
  const lines = [line('Alpha', 'I1', '2026-09-01', 200), line('Alpha', 'I1', '2026-10-01', 300)].concat(extraLines || []);
  return docs(['Alpha'], lines, moves);
}

/* ---------- live data copy ---------- */
function liveDocs() {
  const d = {};
  for (const c of fs.readdirSync(FIXTURE)) {
    for (const f of fs.readdirSync(path.join(FIXTURE, c))) {
      if (f.endsWith('.json')) d[c + '/' + f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(FIXTURE, c, f), 'utf8'));
    }
  }
  return d;
}
const LIVE = liveDocs();

/* =====================================================================
   Seam 1 — Eng.acctStock: Account stock estimated from the Last order
   ===================================================================== */
test.describe('Seam 1: Account stock from the Last order (Eng.acctStock)', () => {

  test('worked example: Last order 300 on 2026-10-01, usual gap 30, today 2026-10-11 -> 200 left, runs out 2026-10-31', () => {
    const r = row(Eng.ctx(workedExample(), TODAY), 'Alpha', 'I1');
    assert.equal(r.estimated, true);
    assert.equal(r.usageSource, 'orders');
    assert.equal(r.tracked, false);
    assert.equal(r.lastDate, '2026-10-01');
    assert.equal(r.lastQty, 300);
    assert.equal(r.interval, 30);
    assert.equal(r.dailyUse, 10);          // 300 / 30
    assert.equal(r.estOnHand, 200);        // floor(300 - 10 x 10)
    assert.equal(r.runOutDate, '2026-10-31'); // 2026-10-01 + 30 days
    assert.equal(r.coverDays, 20);         // 2026-10-11 -> 2026-10-31
  });

  test('worked example after run-out (today 2026-11-15): Est. left is 0 and cover is 0, never negative', () => {
    const r = row(Eng.ctx(workedExample(), '2026-11-15'), 'Alpha', 'I1');
    assert.equal(r.estimated, true);
    assert.equal(r.estOnHand, 0);          // 300 - 10 x 45 = -150 -> 0
    assert.equal(r.coverDays, 0);          // run-out was 15 days ago -> 0
    assert.equal(r.runOutDate, '2026-10-31');
  });

  test('on the run-out day itself the estimate is exactly 0', () => {
    const r = row(Eng.ctx(workedExample(), '2026-10-31'), 'Alpha', 'I1');
    assert.equal(r.estOnHand, 0);          // 300 - 10 x 30
    assert.equal(r.coverDays, 0);
  });

  test('Est. left is floored to a whole number', () => {
    // orders 2026-09-10 and 2026-10-01 (21 days apart), 100 each -> gap 21, daily use 100/21 = 4.7619...
    // 10 days since the Last order: 100 - 47.619 = 52.38 -> 52
    const d = docs(['Alpha'], [line('Alpha', 'I1', '2026-09-10', 100), line('Alpha', 'I1', '2026-10-01', 100)]);
    const r = row(Eng.ctx(d, TODAY), 'Alpha', 'I1');
    assert.equal(r.interval, 21);
    assert.ok(Math.abs(r.dailyUse - 4.76190476) < 1e-6, 'dailyUse ' + r.dailyUse);
    assert.equal(r.estOnHand, 52);
    assert.ok(Number.isInteger(r.estOnHand));
    assert.equal(r.runOutDate, '2026-10-22'); // 2026-10-01 + 21
    assert.equal(r.coverDays, 11);
  });

  test('Cancelled (and not-yet-executed) lines on the Last order date are not counted in Last qty', () => {
    const extra = [
      line('Alpha', 'I1', '2026-10-01', 999, { status: 'Cancelled' }),
      line('Alpha', 'I1', '2026-10-01', 40, { status: 'Pending' }),
    ];
    const r = row(Eng.ctx(workedExample(extra), TODAY), 'Alpha', 'I1');
    assert.equal(r.lastDate, '2026-10-01');
    assert.equal(r.lastQty, 300);
    assert.equal(r.estOnHand, 200);
  });

  test('an opening snapshot line is never taken as the Last order or counted in Last qty', () => {
    // the snapshot (source mentions YTD) is dated after the real Last order; it must be ignored
    const extra = [line('Alpha', 'I1', '2026-10-05', 5000, { source: 'Supplied YTD list' })];
    const r = row(Eng.ctx(workedExample(extra), TODAY), 'Alpha', 'I1');
    assert.equal(r.lastDate, '2026-10-01');
    assert.equal(r.lastQty, 300);
    assert.equal(r.estOnHand, 200);
  });

  test('several Executed lines on the Last order date are summed into Last qty', () => {
    // 2026-09-01: 150; 2026-10-01: 100 + 50 = 150 -> gap 30, daily use 5, 10 days -> 150 - 50 = 100
    const d = docs(['Alpha'], [
      line('Alpha', 'I1', '2026-09-01', 150),
      line('Alpha', 'I1', '2026-10-01', 100),
      line('Alpha', 'I1', '2026-10-01', 50),
    ]);
    const r = row(Eng.ctx(d, TODAY), 'Alpha', 'I1');
    assert.equal(r.lastQty, 150);
    assert.equal(r.dailyUse, 5);
    assert.equal(r.estOnHand, 100);
    assert.equal(r.coverDays, 20);
  });

  test('an item ordered only once uses the account ordering rhythm as its usual gap, as the Expected order does', () => {
    // Beta orders on 2026-06-18, 2026-08-02, 2026-09-16: 90 days over 2 gaps -> account rhythm 45.
    // I2 ordered once, 90 units on 2026-09-16 -> daily use 2; 25 days later 90 - 50 = 40; runs out 2026-10-31.
    const d = docs(['Beta'], [
      line('Beta', 'I1', '2026-06-18', 10), line('Beta', 'I1', '2026-08-02', 10), line('Beta', 'I1', '2026-09-16', 10),
      line('Beta', 'I2', '2026-09-16', 90),
    ]);
    const c = Eng.ctx(d, TODAY);
    const r = row(c, 'Beta', 'I2');
    assert.equal(r.estimated, true);
    assert.equal(r.lastDate, '2026-09-16');
    assert.equal(r.lastQty, 90);
    assert.equal(r.interval, 45);
    assert.equal(r.interval, pred(c, 'Beta', 'I2').interval);
    assert.equal(r.dailyUse, 2);
    assert.equal(r.estOnHand, 40);
    assert.equal(r.runOutDate, '2026-10-31');
    assert.equal(r.coverDays, 20);
  });

  test('a Dormant pair (no order for over a year) has no estimate: estimated false and null fields, never 0', () => {
    // Gamma: I3 on 2025-09-01 and 2025-10-01; 375 days before today -> dormant, no Expected order
    const d = docs(['Gamma'], [line('Gamma', 'I3', '2025-09-01', 100), line('Gamma', 'I3', '2025-10-01', 100)]);
    const c = Eng.ctx(d, TODAY);
    assert.equal(pred(c, 'Gamma', 'I3'), undefined);
    const r = row(c, 'Gamma', 'I3');
    assert.equal(r.estimated, false);
    for (const f of ESTIMATE_FIELDS) assert.strictEqual(r[f], null, f + ' should be null');
  });

  test('a pair without enough orders to know a rhythm has no estimate: estimated false and null fields, never 0', () => {
    // Delta has ordered on one date only -> no item rhythm, no account rhythm, no Expected order
    const d = docs(['Delta'], [line('Delta', 'I1', '2026-10-01', 300)]);
    const c = Eng.ctx(d, TODAY);
    assert.equal(pred(c, 'Delta', 'I1'), undefined);
    const r = row(c, 'Delta', 'I1');
    assert.equal(r.estimated, false);
    for (const f of ESTIMATE_FIELDS) assert.strictEqual(r[f], null, f + ' should be null');
  });

  test('a pair that has a Count keeps the V42 count-based estimate', () => {
    // Count 120 on 2026-10-05. Usage from orders in the last 180 days: 200 + 300 = 500 over max(30, 40 days) -> 12.5/day.
    // 6 days since the count: 120 - 75 = 45; cover floor(45 / 12.5) = 3 -> runs out 2026-10-14.
    const count = { id: 'SM00001', type: 'COUNT', scope: 'acct', account: 'Alpha', itemId: 'I1', item: 'ADOL TEST CAPL',
      qty: 120, date: '2026-10-05', ts: '2026-10-05T08:00:00.000Z', notes: 'test count' };
    const r = row(Eng.ctx(workedExample([], [count]), TODAY), 'Alpha', 'I1');
    assert.equal(r.tracked, true);
    assert.notEqual(r.estimated, true);
    assert.equal(r.baseQty, 120);
    assert.equal(r.delivered, 0);
    assert.equal(r.dailyUse, 12.5);
    assert.equal(r.estOnHand, 45);
    assert.equal(r.coverDays, 3);
    assert.equal(r.runOutDate, '2026-10-14');
  });

  test('live copy: every Al-Falah row carries an estimate (all 41 pairs have an Expected order)', () => {
    const rows = Eng.acctStock(Eng.ctx(LIVE, TODAY), 'Al-Falah').rows;
    assert.equal(rows.length, 41);
    for (const r of rows) {
      assert.equal(r.estimated, true, r.itemId);
      assert.equal(r.usageSource, 'orders', r.itemId);
    }
  });

  test('live copy: Al-Falah 3V INJ (ITM001) - Last order 300 on 2026-02-16, gap 69 -> ran out 2026-04-26, 0 left', () => {
    // golden: lastDate 2026-02-16, interval 69 (account rhythm), nextDate 2026-04-26; 237 days since -> fully used
    const r = row(Eng.ctx(LIVE, TODAY), 'Al-Falah', 'ITM001');
    assert.equal(r.lastDate, '2026-02-16');
    assert.equal(r.lastQty, 300);
    assert.equal(r.interval, 69);
    assert.equal(r.estOnHand, 0);
    assert.equal(r.runOutDate, '2026-04-26');
    assert.equal(r.coverDays, 0);
  });

  test('live copy: Al-Falah ADOL DRP (ITM008) - two lines on 2026-04-26 (500 + 1000) give Last qty 1500', () => {
    const r = row(Eng.ctx(LIVE, TODAY), 'Al-Falah', 'ITM008');
    assert.equal(r.lastDate, '2026-04-26');
    assert.equal(r.lastQty, 1500);
    assert.equal(r.runOutDate, '2026-07-04');  // 2026-04-26 + 69
  });

  test('live copy: Dallah Clinics BUTALIN neb (ITM022) - 1000 on 2026-09-08, gap 45 -> 266 left, runs out 2026-10-23', () => {
    // daily use 1000/45 = 22.22; 33 days -> 1000 - 733.33 = 266.67 -> 266; cover 2026-10-11 -> 2026-10-23 = 12
    const r = row(Eng.ctx(LIVE, TODAY), 'Dallah Clinics', 'ITM022');
    assert.equal(r.lastQty, 1000);
    assert.equal(r.interval, 45);
    assert.equal(r.estOnHand, 266);
    assert.equal(r.runOutDate, '2026-10-23');
    assert.equal(r.coverDays, 12);
  });

  test('live copy: Dawaak (opening snapshot lines only) gets no estimates - null, never 0', () => {
    const rows = Eng.acctStock(Eng.ctx(LIVE, TODAY), 'Dawaak').rows;
    assert.ok(rows.length > 0);
    for (const r of rows) {
      assert.equal(r.estimated, false, r.itemId);
      for (const f of ESTIMATE_FIELDS) assert.strictEqual(r[f], null, r.itemId + ' ' + f);
    }
  });

  test('live copy: a row is estimated exactly when its pair has an Expected order, with the same Last order date and gap', () => {
    const c = Eng.ctx(LIVE, TODAY);
    const byPair = {};
    for (const p of Eng.predictions(c).rows) byPair[p.account + '|' + p.itemId] = p;
    for (const a of c.accounts) {
      for (const r of Eng.acctStock(c, a.name).rows) {
        const p = byPair[a.name + '|' + r.itemId];
        assert.equal(r.estimated, !!p, a.name + ' ' + r.itemId);
        if (p) {
          assert.equal(r.lastDate, p.lastDate, a.name + ' ' + r.itemId);
          assert.equal(r.interval, p.interval, a.name + ' ' + r.itemId);
        }
      }
    }
  });

  test('live copy: no NaN or Infinity in any Account stock row', () => {
    const c = Eng.ctx(LIVE, TODAY);
    let n = 0;
    for (const a of c.accounts) {
      for (const r of Eng.acctStock(c, a.name).rows) {
        n++;
        for (const k of Object.keys(r)) {
          if (typeof r[k] === 'number') assert.ok(Number.isFinite(r[k]), a.name + ' ' + r.itemId + ' ' + k + '=' + r[k]);
        }
      }
    }
    assert.ok(n > 0);
  });
});

/* =====================================================================
   Seam 2 — Eng.predictions: Expected orders unchanged
   ===================================================================== */
test.describe('Seam 2: Expected orders unchanged (Eng.predictions)', () => {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

  function assertGolden(rows) {
    assert.equal(rows.length, golden.length);
    assert.equal(rows.length, 133);
    golden.forEach((g, i) => {
      for (const k of Object.keys(g)) assert.deepStrictEqual(rows[i][k], g[k], 'row ' + i + ' (' + g.account + ' ' + g.itemId + ') field ' + k);
    });
  }

  test('live copy: the 133 Expected orders equal the golden file field for field', () => {
    assertGolden(Eng.predictions(Eng.ctx(LIVE, TODAY)).rows);
  });

  test('live copy: working out every account\'s Account stock first does not change any Expected order', () => {
    const c = Eng.ctx(LIVE, TODAY);
    for (const a of c.accounts) Eng.acctStock(c, a.name);
    assertGolden(Eng.predictions(c).rows);
  });

  test('hand case: Last order 2026-10-01 + usual gap 30 -> Expected order 2026-10-31 at the median qty 250', () => {
    const p = pred(Eng.ctx(workedExample(), TODAY), 'Alpha', 'I1');
    assert.equal(p.lastDate, '2026-10-01');
    assert.equal(p.n, 2);
    assert.equal(p.interval, 30);
    assert.equal(p.qty, 250);            // median of 200 and 300
    assert.equal(p.netUnit, 2);          // Last order's net unit price
    assert.equal(p.value, 500);          // 250 x 2
    assert.equal(p.nextDate, '2026-10-31');
    assert.equal(p.daysTo, 20);
    assert.equal(p.status, 'soon');
    assert.equal(p.confidence, 'medium');
  });

  test('an order-based estimate does not pull the Expected order forward (stays 2026-10-31, not run-out minus lead days 2026-10-24)', () => {
    // Account stock worked out first (fresh ctx, so predictions are not cached yet), then the Expected order
    const c = Eng.ctx(workedExample(), TODAY);
    Eng.acctStock(c, 'Alpha');
    assert.equal(pred(c, 'Alpha', 'I1').nextDate, '2026-10-31');
    assert.equal(pred(c, 'Alpha', 'I1').status, 'soon');
  });

  test('a count-based run-out still pulls the Expected order forward (run-out 2026-10-14 minus 7 lead days = 2026-10-07)', () => {
    const count = { id: 'SM00001', type: 'COUNT', scope: 'acct', account: 'Alpha', itemId: 'I1', item: 'ADOL TEST CAPL',
      qty: 120, date: '2026-10-05', ts: '2026-10-05T08:00:00.000Z', notes: 'test count' };
    const p = pred(Eng.ctx(workedExample([], [count]), TODAY), 'Alpha', 'I1');
    assert.equal(p.nextDate, '2026-10-07');
  });

  test('an item ordered once takes the account rhythm, at low confidence', () => {
    const d = docs(['Beta'], [
      line('Beta', 'I1', '2026-06-18', 10), line('Beta', 'I1', '2026-08-02', 10), line('Beta', 'I1', '2026-09-16', 10),
      line('Beta', 'I2', '2026-09-16', 90),
    ]);
    const p = pred(Eng.ctx(d, TODAY), 'Beta', 'I2');
    assert.equal(p.n, 1);
    assert.equal(p.interval, 45);
    assert.equal(p.confidence, 'low');
    assert.equal(p.nextDate, '2026-10-31');
  });
});
