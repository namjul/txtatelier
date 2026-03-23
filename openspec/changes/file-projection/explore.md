# Explore: file-projection

## What we are noticing

The `sync-txt-files` change stubs out `file-projection` as a named capability without implementing it. The stub defines the shape — links, backlinks, metadata — but leaves the sigil syntax undefined. That means we are designing both the parsing layer *and* the format it parses at the same time.

A grammar toolkit (OHM.js, evaluated against this spec) looks attractive, but may be premature: there is no concrete syntax to parse yet. The format exists only as intent.

We also notice that the projection layer is load-bearing for linked-file sync: non-txt files only enter the sync graph when a `.txt` file's projection links to them. This makes the projection boundary a gating constraint for a larger capability, not just an isolated utility.

## What we don't understand

- What does the sigil syntax actually look like? Is it wikilink-style (`[[path]]`), org-mode-style (`[[file:path]]`), something custom?
- What counts as a metadata annotation — YAML front-matter, inline `key: value` at start of file, something else?
- How does the projection get computed — on demand, incrementally on write, or at startup?
- Does the projection need to survive across restarts, or is it always derived from current file content?
- Is backlink derivation a query-time operation (scan all projections) or maintained as an index?
- How large are the files in practice? Does parsing performance matter?

## What we want to poke at

- Write two or three example `.txt` files that would represent realistic content — and see what sigil syntax feels natural to express links and metadata.
- Check whether any existing file content in the watch directory already uses informal link syntax (e.g. bare paths, markdown links, `[[...]]`).
- Sketch a minimal projection type in TypeScript — just the shape, no parser — to validate that links/backlinks/metadata covers the actual use cases.

## What would make this worth a full intervention

If we can write three example files and agree on a sigil syntax that feels natural to read and write, that is enough to form a claim. The grammar and parser follow from the syntax; the syntax has to come first.
