# Stock is worked out from orders only; stock entry is hidden

In October 2026 the owner decided not to type in any stock. What matters is when each account will order again, and that is predicted from the account's last order of an item and its usual ordering rhythm; each account's shelf stock is estimated the same way, from what it ordered. The owner's own stock is therefore not tracked, and the stock-entry screens (counts, receipts, adjustments, stock import) are hidden, not removed. The owner can switch them back on, and off again, at any time with the Stock entry settings button on the Stock screen (added 11 Oct 2026 at the owner's request); each switch saves `master/settings.stockEntry` and an audit row.

## Consequences

- Nothing may show the owner's stock as a number while entry is hidden: it is "Not tracked", never 0, and no alert may depend on it.
- ADR-0007 still describes how own stock works if entry is switched back on.
