# History is never deleted or rewritten

Order lines, deals, items and accounts are never deleted. Cancelling an order line sets its status to Cancelled; retiring a deal or closing an account changes a flag; every change writes an audit row. New features add new fields or collections rather than reshaping existing ones. This costs some storage and makes "clean-up" impossible, in exchange for a ledger that always reconciles and can be traced line by line.
