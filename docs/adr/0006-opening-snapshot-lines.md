# Opening snapshot lines count in sales but not in ordering rhythm

The orders carried over from the Excel workbook include lump lines that record a month's quantity rather than a dated order. They count in executed net (so totals match the old workbook to the halala), but are excluded when working out ordering rhythm and expected orders, because a lump line would make an account look like it orders rarely and in bulk. They are recognised by their source; for that reason an import must never write a file name containing "YTD" into an order's source.
