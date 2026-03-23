# Gesture: markdown-as-txtfiles

## Gesture type
strengthen

## What are we gesturing toward?
txt-file-filter — the capability that determines which files are considered text files worthy of sync.

## Claim
Extending the filter to accept `.md` files alongside `.txt` will allow users to work with their existing markdown files without conversion or friction.

## What made us do this?
Users write in `.md` files. The current `isTxtFile` filter accepts only `.txt`, so `.md` files are completely invisible to the sync system. A markdown file is just text — no structural parsing is needed at the sync layer. The rejection of `.md` was a scope decision, not a technical incompatibility.

## What are our load-bearing assumptions?
1. **Markdown is text**: The content of `.md` files can be treated identically to `.txt` — stored raw, no parsing at capture time.
2. **Path-agnostic pipeline**: The sync, projection, and conflict detection layers work with file paths and content, not specific extensions.

## Spec files this gesture touches

- `specs/txt-file-filter/spec.md` — extend extension allowlist to include `.md`

