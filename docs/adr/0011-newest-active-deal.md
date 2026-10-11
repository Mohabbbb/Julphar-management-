# Current quotes use the newest eligible active deal

Date: 2026-10-11
Status: approved by owner: “Use the newest active deal.”

## Problem

The order builder marked multiple Active deals for one account/item as unpriceable, while the deal-import planner compared against the greatest effective start date. Current quotes should use one explicit rule consistently without repricing stored orders.

## Decision

`src/pricing.js` is the pure current-quote selector. The app's `resolve` delegates to it. The order-import planner already receives that same resolver through its `price` callback, so manual new orders, current pricing views and order imports now share selection.

An eligible deal has status exactly `Active`, matches the selected account and item, and includes today's local calendar date between `from` and `to` (inclusive). Blank bounds are open. A future or expired deal is not eligible. A malformed or reversed date range on a matching Active deal requires review instead of silently choosing a different price.

Choose the greatest `from` among eligible deals; blank start dates rank oldest. For equal start dates, choose the latest `updatedAt` (or legacy `updated`), then latest `createdAt`, then greatest deal ID. Same-prefix numeric IDs compare numerically (`D10` follows `D9`); otherwise IDs compare lexically. This eliminates dependence on database/array order for distinct IDs. Identical IDs and timestamps remain duplicate-record data issues, outside this change.

The selected deal's discount must be a finite number between 0 and 1, inclusive. An invalid winning discount requires review; never fall back to an older deal or the standard rate. Only when there is no eligible deal may the valid item standard discount apply. Missing account, inactive/missing item, or invalid reference price remains unpriced. Account availability is still enforced by the existing caller UI; the module does not alter customer activation policy.

Pricing uses today as before, including current rule lookup for imported orders lacking an explicit discount. Explicit import discounts retain their existing behavior. Saved order values are frozen and are never passed through a repricing migration. This module neither reads nor writes storage.

## Scope kept separate

Deal import/edit retirement and write rules are unchanged, including which Active records are retired when a replacement deal is saved. The deal-import planner's advisory selection is unchanged. This change does not alter general money arithmetic, rounding, saved order prices, or sales totals.

## Verification

Ten pricing tests cover newest selection, input ordering, date bounds, expired/future/inactive deals, deterministic ties, invalid winning discounts, malformed dates, standard/missing rates, account/item isolation, and equality between current quote and order-import pricing. All pass.

On the existing fixture (379 deals, 2,538 account/item quote combinations, evaluated 2026-10-11), **zero current quotes change** versus the previous resolver. Input documents, including stored historical order values, remain byte-for-byte unchanged after this comparison. The new behavior is observable when overlapping Active deals, future/expired deals, or tie cases occur; synthetic tests cover those cases.
