# Stock starts from a count; no backdating

Stock is worked out forward from an item's latest count: count + receipts + adjustments − executed deliveries after the count. Orders saved before the first count are never deducted, and an item with no count is "Not tracked" rather than zero. Rebuilding stock backwards from old orders would invent quantities nobody counted.

Status: on hold while stock entry is hidden — see ADR-0010.
