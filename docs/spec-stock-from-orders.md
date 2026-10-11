# Spec: stock from orders only, stock entry hidden (V44)

Decision: ADR-0010. Words: CONTEXT.md (Last order, Expected order, Account stock, Own stock, Count).
Baseline: live V43, data copy in `t/fixture/` (499 order lines, executed net 721,249.04 SAR, no stock documents), "today" = 2026-10-11 for all live-data checks.

## 1. Engine — `src/engine.js` (pure, ES5: no let/const/arrow functions, same style as the file)

### 1a. `Eng.acctStock(ctx, accountName)` — customer shelf stock estimated from the last order
For a row (account × item) that has **no count** for that account and item:

- If the pair has an expected order in `Eng.predictions(ctx)` (same account, same item), the row carries an estimate:
  - `estimated: true`, `usageSource: 'orders'`, `tracked: false`
  - `lastDate` = that prediction's `lastDate`
  - `lastQty` = total executed quantity for that account and item on `lastDate` (Cancelled lines and opening snapshot lines excluded)
  - `interval` = that prediction's `interval` (days)
  - `dailyUse` = `lastQty / interval`
  - `estOnHand` = `max(0, floor(lastQty − dailyUse × daysBetween(lastDate, today)))`
  - `runOutDate` = `addDays(lastDate, interval)`
  - `coverDays` = `max(0, daysBetween(today, runOutDate))`
- If the pair has no expected order (dormant, never ordered, or not enough orders to know a rhythm): `estimated: false`, and `lastQty`, `interval`, `dailyUse`, `estOnHand`, `runOutDate`, `coverDays` are `null` (never 0).

Rows that **have** a count keep today's V42 count-based behaviour exactly.

Worked example: last order 2026-10-01, 300 units, interval 30 days, today 2026-10-11 → dailyUse 10, estOnHand floor(300 − 10×10) = 200, runOutDate 2026-10-31, coverDays 20. Today 2026-11-15 → estOnHand 0, coverDays 0.

### 1b. `Eng.predictions(ctx)` — unchanged
Expected order = last order + usual interval, at the usual (median) quantity and the last order's net unit price. Order-based estimates from 1a must **not** move `nextDate`; only a count-based run-out date may (existing V42 rule). On the live data copy the 133 predictions must equal `t/golden/predictions_2026-10-11.json` field for field.

### 1c. Everything else in the engine — unchanged.

## Resumption note — 11 October 2026

The published artifact moved forward after this original spec: version `1791725872-0dd9` adds the order-driven prepare and customer-stock tables. The resumed release preserves that published OFF-mode experience and adds the previously requested owner switch. The following supersedes conflicting OFF-mode presentation bullets below:

- OFF Stock retains two published cards: What to prepare (next 30 days) and Customer stock, including search/status filters and reviewed draft-order actions.
- OFF Today retains To prepare (30 days); the fixture yields 11 items and 1,873 units. This is planned demand, not measured own stock.
- OFF does not display manual count fields or stock import controls. ON restores the existing manual-stock experience; switching back OFF restores the published order-driven view.
- The active published screen omits customer/item rows without an expected order rather than presenting the earlier account-picker/dash-row layout.
- A switch writes its setting and one audit row. If the audit write fails after the setting succeeds, the dialog must state that partial result and offer history-only retry without repeating the settings write or duplicating the history record.
- Browsing and cancelling an untouched switch dialog write nothing; confirming the switch is the explicit exception to the older blanket no-new-writes rule.
- Pricing rules, executed sales, existing order/deal/item/account data remain unchanged.

## 2. Page — `src/app.js`, `src/page.html`, `src/css/*`

**Switch:** stock entry is ON only when `master/settings` has `stockEntry === true`. Absent or anything else = OFF. The flag is written only by the owner's **Stock entry settings** button on the Stock screen: a details dialog explains what turning it on or off changes; confirming saves `stockEntry` true/false and one audit row (field `stockEntry`, old → new). Cancel writes nothing; nothing is ever deleted.

**When OFF (the default):**
- There is nowhere to type or save own stock or customer stock: no count inputs, no "Save" / "Save all changed" for stock, no Receive delivery, Adjust, Count, Set up / opening quantities, no "Record a count" for a customer.
- Import from Excel offers Orders, Items & prices and Deals only — no "Stock counts" type and no stock-count template.
- Own stock appears only as one plain line: "Your own stock isn't tracked — stock entry is switched off." No numbers, no zeros, no stock statuses (Out / Short / Low).
- Stock section shows **Customers' stock**: pick an account → table of its items: Item · Last order (date) · Last qty · Usual gap (days) · Est. left now · Runs out · Expected order (date and status from predictions). Items without an estimate show "—" and the note "Not enough orders yet", never 0.
- Today: no stock tile and no stock or count alerts; expected orders and "Draft order" work as before.
- Order builder and saved-order card show no stock hints.
- "How it works" guide: the stock part says stock is worked out from orders (last order + usual gap) and stock entry is switched off.

**When ON (`stockEntry: true`):** V43 behaviour, screens and alerts exactly as today.

**Always:** no new database writes of any kind; executed net on Dashboard 721,249.04 and 499 order lines; 0 console errors except the blocked Google Fonts request; at 390 px wide the Stock section has no horizontal page scroll.

## 3. Test seams (agreed)
1. `Eng.acctStock` (1a) — node tests with small hand-computed fixtures + live-copy smoke.
2. `Eng.predictions` (1b) — regression lock against the golden file + one hand-computed case.
3. The built page (`python3 build.py`) in headless Chromium, data loaded through the embedded seed (offline mode): section 2 behaviour, OFF and ON.

Tests live in `t/`; source in `src/`. Run all: `bash t/run_all.sh`.
