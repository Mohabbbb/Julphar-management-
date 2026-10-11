# Julphar Sales Platform

A single-owner sales-management platform for selling pharmaceutical items to pharmacy and clinic accounts: it records orders, prices them from deals, and turns order history into stock, expected reorders and monthly targets. Built for Julphar, but owned by Hoba and meant to be reused for any company, catalogue or set of accounts.

## People and parties

**Owner**:
The one person who enters and edits data. There are no other editors.
_Avoid_: user, admin, rep

**Account**:
A customer the owner sells to — a pharmacy, pharmacy chain or clinic — identified by an account ID and known by one name plus optional aliases.
_Avoid_: customer, client, pharmacy (as a generic term)

**Closed account**:
An account the owner has stopped selling to. Its history is kept and still counts in the ledger, but it is left out of lists, KPIs, expected orders and targets. It can be reopened.
_Avoid_: deleted account, inactive account

## Catalogue and pricing

**Item**:
One sellable product at a specific form, strength and pack (e.g. ADOL 500MG CAPL 2X12), identified by an item ID.
_Avoid_: SKU, product, medicine

**RSP**:
The item's public retail selling price per unit, before any discount.
_Avoid_: list price, base price, price

**Standard discount**:
The default discount on an item for any account that has no deal for it.
_Avoid_: default rate, normal discount

**Deal**:
An account-specific discount on one item, valid over a date range, that overrides the standard discount. A deal is either active or retired; it is never deleted.
_Avoid_: quotation, contract, offer

**Below-standard deal**:
A deal that gives the account a smaller discount than the item's standard discount. Flagged for the owner, never changed automatically.

**Net unit price**:
RSP minus the applied discount — what the account pays per unit.
_Avoid_: net price, cost

**Item mapping**:
The record that links a name used in a source document (deal file, photo, pasted list) to one item.
_Avoid_: alias (aliases belong to accounts)

## Orders

**Order line**:
One item at one quantity for one account on one date, with its status and its frozen net value. The basic unit of the ledger.
_Avoid_: transaction, TX, row, YTD line

**Order**:
The group of order lines saved together under one order reference.
_Avoid_: request, basket

**Order status**:
Where an order line stands: **Executed** (delivered and counted as a sale), **Pending** (agreed, not yet delivered), **Quoted** (offered, not yet agreed) or **Cancelled** (kept for the record, counts for nothing).
_Avoid_: done, open, void, deleted

**Executed net**:
The sum of the net values of all Executed order lines, in SAR. This is the platform's headline sales figure.
_Avoid_: YTD, total sales, revenue

**Pipeline**:
All Pending and Quoted order lines — business agreed or offered but not yet delivered.
_Avoid_: backlog, open orders

**Opening snapshot line**:
An order line carried over from the old Excel workbook that records a lump quantity for a month rather than a real dated order. Counts in executed net, but is ignored when working out ordering rhythm.
_Avoid_: YTD opener, history line

**Separate order**:
Two order lines that look like duplicates but that the owner has confirmed are genuinely different orders.
_Avoid_: duplicate, DUP

**Re-price**:
Recalculating an order line's net value from the deal and standard discount in force today. Only happens when the owner asks for it.

## Stock

**Own stock**:
The owner's quantity of an item on hand, ready to sell.
_Avoid_: inventory, warehouse

**Account stock**:
An account's estimated quantity of an item still on its shelves.
_Avoid_: customer stock, shelf stock

**Count**:
A quantity of an item physically counted at a point in time. The first count of an item is its opening count. A count is the starting point for all stock maths after it.
_Avoid_: stock take, baseline (in conversation)

**Untracked item**:
An item with no count. Its stock is unknown and shown as "Not tracked", never as zero.

**Reserved**:
Quantity on Pending (and, by default, Quoted) order lines — promised but not yet delivered.

**Available**:
Own stock on hand minus reserved.

**Cover**:
How many days available stock lasts at the item's recent daily use.
_Avoid_: runway, days left

## Forecasting and targets

**Expected order**:
A predicted next order of one item by one account, with a date, quantity and value worked out from that account's past ordering rhythm.
_Avoid_: forecast, prediction, reorder

**Ordering rhythm**:
The usual quantity and interval between an account's orders of an item.
_Avoid_: frequency, cycle

**Lapsed**:
An account–item pair whose expected order is well overdue — a win-back candidate.
_Avoid_: lost, churned

**Dormant**:
An account–item pair with no order in over a year. No expected order is made for it.

**Target**:
A month's sales goal in SAR net, broken down across accounts and items so the parts add up exactly to the total.
_Avoid_: budget, quota, plan

**Run rate**:
This month's executed net so far, scaled to the full month.

## Data safety

**Ledger**:
The complete set of order lines, including Cancelled lines and closed accounts. Reconciliation is always against the ledger, never against a filtered view.
_Avoid_: database, history

**Audit row**:
The permanent record of one change: what changed, from what, to what, when and why.
_Avoid_: log entry

**Backup**:
A full copy of all platform data downloaded as one file, which can later be restored.
_Avoid_: export (an export is a report)

**Export**:
An Excel workbook generated from the platform data for reading, reporting or sharing. Never the master copy.
_Avoid_: master workbook, the Excel
