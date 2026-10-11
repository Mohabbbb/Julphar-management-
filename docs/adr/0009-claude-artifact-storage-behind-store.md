# Data lives in a claude.ai artifact database, behind one swap point

The Platform is a private claude.ai artifact and keeps its data in the artifact's own database (documents of at most 256 KiB, owner-only writes), split into monthly and per-account documents with overflow pages. All reads and writes go through one data layer (`Store`), so that moving to a real hosted backend later means replacing that layer only. Chosen because it needs no server, login or hosting today; the cost is the per-document size limit and no transactions (see ADR-0002).
