# The Platform database is the master; Excel is only an export

Until V39 the Excel workbook was the master and the web page a read-only view refreshed from it. In October 2026 the owner moved the master copy into the Platform's own database: all entry and editing happens there, and Excel workbooks are generated from it for reports, sharing and backup. Two masters kept drifting apart; one master with a generated workbook cannot.

## Consequences

- Never edit an exported workbook and expect the change to come back. Changes go into the Platform (directly or through Import).
- The frozen 22-sheet workbook (sha `0b1f2824…`) is kept in `Reference/` as the seed the database was built from, not as a live file.
