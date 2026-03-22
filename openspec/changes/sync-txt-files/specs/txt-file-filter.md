# Delta Spec: txt-file-filter

## What behavior is being added?

The change-capture plan layer gains a positive file-type filter. Before a file is evaluated for insert, update, or skip, its extension is checked against an allowlist. In this change the allowlist contains only `.txt`.

Files that do not match the allowlist are silently passed over — no record is created, no error is emitted, no log entry is written at normal log levels.

This filter applies uniformly to all code paths that feed change-capture: the filesystem watcher, startup reconciliation, and any future capture triggers.

## What behavior is changing?

Previously, any file that survived the ignore filter (dotfiles, temp files, system files) would be evaluated for capture and potentially inserted into Evolu as a `File` record.

After this change, only `.txt` files reach that evaluation. A `.md` file, a `.png`, a `.json` — all are filtered out before the plan is computed.

## What behavior is being removed?

Non-txt files can no longer enter Evolu as `File` records through the normal sync path. This is intentional. The only future path for non-txt files to be synced is via links from `.txt` files — a capability not yet built.

## What stays the same?

- The ignore system (`ignore.ts`) is unchanged. It continues to operate as a denylist before the txt filter runs.
- State-materialization is unchanged. It materializes whatever is in Evolu; the filter upstream ensures only `.txt` records exist.
- Conflict detection, hash computation, and all other change-capture logic are unchanged for files that pass the filter.
- The 10MB file size limit and all other existing guards remain in place.
