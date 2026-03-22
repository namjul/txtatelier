# Design: sync-txt-files

## Approach

Add a single extension check inside `planChangeCapture` in `change-capture-plan.ts`, immediately after the ignore check. Extract the file extension from `state.path` and return a `skip` action for any path whose extension is not `.txt`.

The check is a plain string operation — no new dependency, no new module. The allowlist is a small constant defined in the same file or a dedicated `txt-filter.ts` alongside `ignore.ts`.

```
if (!isTxtFile(state.path)) {
  return [skip("not-txt-file", state.path)];
}
```

`isTxtFile` checks `path.extname(state.path).toLowerCase() === ".txt"`.

## Why this approach?

The plan layer is the right place because it is the single decision point for all capture code paths — watcher events and startup reconciliation both feed through `planChangeCapture`. A filter here is unconditionally applied regardless of how a file event originates.

Putting it in the watcher would miss startup reconciliation. Putting it in state-materialization would be wrong — that layer is a pure consumer of Evolu records and should remain agnostic about file types.

The ignore system is a denylist of noise patterns. The txt filter is a positive allowlist of meaningful content. They are orthogonal concerns and should stay separate.

## What are our load-bearing assumptions about the approach?

- `planChangeCapture` is the sole choke point for all capture paths. If a second capture path exists that bypasses this function, the filter will not apply there.
- Deleted files (where `state.diskHash === null`) are handled correctly: a `.txt` file that existed and was deleted should still be processed (mark deleted in Evolu), not filtered out. The extension check must not apply to deletions of previously-synced files.
- Node's `path.extname` returns an empty string for files with no extension and the full extension including the dot otherwise. `.txt` files reliably return `.txt`.

## Risks and trade-offs

- **Deletion of non-txt files**: If a non-txt file was somehow already in Evolu (e.g. from before this change), its deletion on disk will now be skipped by the filter. The record will remain as a ghost in Evolu. This needs a one-time migration or an explicit exception: if a file is deleted and `state.evolId !== null`, process the deletion regardless of extension.
- **Case sensitivity**: On case-insensitive filesystems (macOS, Windows), `.TXT` is a `.txt` file. The check should normalize to lowercase.

## What we are not doing

- Not filtering at the watcher level (`watch.ts`).
- Not adding a filter to state-materialization.
- Not implementing the file projection layer in this change.
- Not supporting any extension other than `.txt` — no `.md`, no `.org`, no `.sub`.
- Not syncing linked non-txt files — that is a future change dependent on the projection layer.

## Known unknowns

- How to handle the ghost-record risk cleanly: add a special case for `evolId !== null` deletions, or defer to a migration? The safest path is to let the filter pass any file whose `state.evolId !== null` and `state.diskHash === null` (deletion of a known record) regardless of extension.

## Co-variance: what else might this touch?

- `change-capture-plan.ts` — primary change site
- Possibly a new `isTxtFile` utility, either inline or in a small adjacent file
- Tests for `planChangeCapture` will need cases covering the new filter branch

## ⚠ Design warnings

### Responsiveness

No user-visible feedback changes. Non-txt files are silently skipped, same as ignored paths. No regression in responsiveness.

### Continuity after correction

Not applicable. This change does not affect user-facing editing or recovery flows.

### Exploratory capacity

A user who drops a non-txt file into a watched directory will see it go unsynced with no explanation. This is correct behavior, but the silence could be surprising. A debug-level log entry for skipped non-txt files (matching the existing pattern for skipped ignored paths) is sufficient.
