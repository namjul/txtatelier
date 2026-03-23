# Gesture: file-projection

## Gesture type

create

## What are we gesturing toward?

The `file-projection` capability — the layer that derives structured data from a `.txt` file's raw content. Specifically: title, desc, and outgoing links. This is a named stub in the system that currently has no implementation. It is load-bearing for linked-file sync, because non-txt files only enter the sync graph when a projection links to them.

`createdAt` and `updatedAt` are already auto-columns in Evolu and require no schema changes.

## Claim

After this change, every `.txt` file processed by the sync system will have a computed projection — title (first non-empty line or heading), desc (short excerpt from subsequent lines), and outgoing links (`[[path]]` sigils parsed from content). Backlinks are derived at query time by scanning projections, not maintained as a separate index. When a file is renamed, all `.txt` files that link to the old path will have their `[[...]]` sigils rewritten to the new path automatically. This makes the projection boundary concrete enough to unblock linked-file sync and UI display.

## What made us do this?

The `sync-txt-files` change introduced `file-projection` as a named capability without implementing it. The stub defines the shape but leaves parsing undefined. The capability is referenced by name in the sync graph logic, making it a concrete hole rather than a future idea. The explore surfaced that sigil syntax and computation model need to be decided before any parser work can begin.

## What are our load-bearing assumptions?

- `[[path]]` wikilink-style sigils are the right syntax for link references in `.txt` files — natural to read and write, easy to parse, unambiguous.
- Title can be reliably extracted from the first non-empty line of content without requiring a formal front-matter block.
- Backlink derivation as a query-time scan across all projections is acceptable at the file counts this system targets (no maintained index needed).
- Link rewriting on rename is a safe file mutation — replacing `[[oldPath]]` with `[[newPath]]` preserves all other content and is idempotent.

## Spec files this gesture touches

- `specs/file-projection/spec.md` — new capability spec

## Co-variance: what else might this touch?

- `file-sync` — the startup reconciliation and change capture paths will need to invoke projection after content is written
- `content-based-rename-detection` — the rename executor path is the integration point for triggering link rewrites; projection supplies the backlinks scan that identifies which files to rewrite
- linked-file sync (future) — projection links are the entry point for non-txt files into the sync graph
- display layer (future) — title and desc surface in any UI that lists files
