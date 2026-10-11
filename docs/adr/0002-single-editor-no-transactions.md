# One editor, last write wins

Only the owner writes data, so the Platform has no locking or transactions: each document is saved with a version check, and the last successful save wins. This keeps the storage simple enough to live inside a claude.ai artifact. It must be revisited before a second person is allowed to edit.
