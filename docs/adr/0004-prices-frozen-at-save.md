# An order line's price is frozen when it is saved

The net value of an order line is calculated from the deal and standard discount in force when it is saved, and stored. Later deal or price changes do not touch it. A line is recalculated only when the owner explicitly re-prices it. Past sales therefore stay exactly what was invoiced, even though the current deal says otherwise.
