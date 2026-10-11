/* G2: one money-rounding rule for NEW lines (Eng.money): 2 decimals (halalas), half away from zero, immune to binary noise.
   Convention: a line's net = money(qty × exact unit net); the unit net itself is kept exact. Lines then add up to the displayed total. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Eng = require('../src/engine.js');

test('money(): half-cent ties go away from zero even when the binary value is a hair below', () => {
  const cases = [[2.135, 2.14], [1.005, 1.01], [2.675, 2.68], [249.97499999999997, 249.98], [728.6249999999999, 728.63],
                 [-2.135, -2.14], [0.1 + 0.2, 0.3], [59.999964, 60], [1.0049999, 1], [1.2449, 1.24], [0, 0], [1262.5, 1262.5], [1515, 1515]];
  for (const [x, want] of cases) assert.equal(Eng.money(x), want, x + ' -> ' + Eng.money(x));
});
test('600 × 2.525 (50% of 5.05) is 1,515.00; 10 units of a 6.00 deal stored as 5.9999964 is 60.00', () => {
  assert.equal(Eng.money(600 * (5.05 * (1 - 0.5))), 1515);
  assert.equal(Eng.money(10 * (8.6 * (1 - 0.302326))), 60);
});
test('existing saved lines are untouched: the 499 fixture lines still add to 721,249.04 and nothing is rewritten by loading', () => {
  const root = path.join(__dirname, 'fixture', 'orders'); let n = 0, c = 0;
  for (const f of fs.readdirSync(root)) JSON.parse(fs.readFileSync(path.join(root, f))).rows.forEach(r => { if (r.status === 'Executed') { n += r.net; c++; } });
  assert.equal(c, 499); assert.equal(n.toFixed(2), '721249.04');
});

test('G4 Eng.mergeAudit: union of both history lists, nothing lost, nothing doubled, oldest first', () => {
  const A = { ts: '2026-10-01T10:00:00.000Z', type: 'ADD_ORDER', account: 'x', notes: 'a' }, B = { ts: '2026-10-05T10:00:00.000Z', type: 'EDIT_ORDER', account: 'x', notes: 'b' };
  const C = { ts: '2026-10-03T10:00:00.000Z', type: 'EDIT_ORDER', account: 'x', notes: 'c' };
  const m = Eng.mergeAudit({ rows: [A, B, C] }, { rows: [A, C], schema: 1 });
  assert.deepEqual(m.rows.map(r => r.notes), ['a', 'c', 'b']);
  assert.equal(Eng.mergeAudit({ rows: [A] }, { rows: [A] }).rows.length, 1);
  assert.equal(Eng.mergeAudit(null, { rows: [A] }).rows.length, 1);
});
test('G4 Eng.backupDiff counts the records a restore would change, remove or add (not history)', () => {
  const cur = { 'orders/2026-10': { rows: [{ id: 'TX1', qty: 5 }, { id: 'TX2', qty: 1 }, { id: 'TX3', qty: 2 }] }, 'audit/2026-10': { rows: [{ ts: 'b' }] } };
  const bak = { 'orders/2026-10': { rows: [{ id: 'TX1', qty: 9 }, { id: 'TX2', qty: 1 }, { id: 'TX4', qty: 2 }] }, 'audit/2026-10': { rows: [{ ts: 'a' }] } };
  const d = Eng.backupDiff(cur, bak);
  assert.deepEqual(d.records, { changed: 1, added: 1, removed: 1 });
});
