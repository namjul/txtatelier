# Delta Spec: txt-file-filter

## What behavior is being added?

The file-type filter now accepts `.md` files in addition to `.txt` files. A file with either extension passes through to change-capture evaluation and can be synced to Evolu.

Files with other extensions continue to be silently passed over.

## What behavior is changing?

Previously, only `.txt` files survived the type filter and reached change-capture evaluation. `.md` files were filtered out before any plan was computed.

After this change, both `.txt` and `.md` files are evaluated for capture. A `.md` file will now:
- Be picked up by the filesystem watcher
- Be reconciled on startup
- Have its content hashed and synced to Evolu
- Be subject to conflict detection and rename detection

## What behavior is being removed?

Nothing. The previous `.txt`-only restriction is relaxed, not replaced.

## What stays the same?

- The ignore system (`ignore.ts`) continues to operate as a denylist before the type filter runs
- The file size limit (10MB) and all other existing guards remain in place
- Conflict detection, hash computation, and all change-capture logic are unchanged
- Files with extensions other than `.txt` and `.md` continue to be filtered out
