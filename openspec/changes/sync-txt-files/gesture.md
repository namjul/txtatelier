# Gesture: sync-txt-files

## Gesture type

create

## What are we gesturing toward?

The file sync pipeline — specifically the change-capture plan layer that decides which files enter Evolu as `File` records.

This change introduces a **txt-first sync policy**: only `.txt` files are synced by default. Non-txt files may be synced later, but only as a consequence of being linked from a `.txt` file.

A second, adjacent thing is gestured toward but not yet built: a **file projection layer** — a per-file structural view that exposes links, backlinks, and metadata. This projection layer is the prerequisite for the future linked-file sync path. It is named here to establish intent, not implemented in this change.

## Claim

If we restrict change-capture to `.txt` files at the plan layer, the sync will silently ignore non-txt files without requiring changes to the watcher, state-materialization, or the conflict detection logic. State-materialization remains a pure consumer of whatever Evolu holds — it does not need its own filter.

## What made us do this?

The app's identity is working with text files, but the sync has no awareness of file type. A watched directory full of images, PDFs, or binaries would sync everything indiscriminately into Evolu. The system needs a clear, positive statement of what it cares about.

The choice of `.txt` as the sole initial extension is deliberate: it is the most unambiguous text format, requires no parser, and gives a clean baseline before format-specific support is added.

## What are our load-bearing assumptions?

- The plan layer in `change-capture-plan.ts` is the right and sufficient place for the filter. No other layer (watcher, state-materialization, schema) needs a parallel guard.
- State-materialization correctness is preserved because it materializes whatever is in Evolu — if only `.txt` records exist, only `.txt` files get written. No asymmetry.
- The future linked-file sync path (non-txt files synced because a `.txt` file links to them) can be added as a separate, downstream pass over the file projection layer. This change does not foreclose that path.

## Spec files this gesture touches

- `specs/txt-file-filter/spec.md` — new: `.txt`-only policy in change-capture plan
- `specs/file-projection/spec.md` — new: structural projection of a parsed txt file (links, backlinks, metadata); stub only in this change, full implementation is a future change

## Co-variance: what else might this touch?

- Startup reconciliation — feeds non-ignored files into change-capture the same way the watcher does. The txt filter in the plan layer applies uniformly; no separate handling needed.
- Future linked-file sync — the projection layer named here becomes the foundation for a second sync pass that includes non-txt files referenced by links. That pass will need to emit warnings for links pointing to files that don't exist on disk.
- The ignore system (`ignore.ts`) remains orthogonal — it is a denylist of noise patterns; the txt filter is a positive allowlist of meaningful content. Both coexist.
