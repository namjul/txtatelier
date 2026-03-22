# Delta Spec: file-projection (stub)

## What behavior is being added?

None in this change. This spec names the capability and establishes its shape for future implementation.

A file projection is a structural view of a parsed `.txt` file. For a given file path it exposes:

- **links** — paths referenced within the file body (to be defined by sigil syntax in a future change)
- **backlinks** — other files that link to this file (derived, not stored)
- **metadata** — key-value pairs from the file header or inline annotations

The projection layer is the prerequisite for the linked-file sync path: non-txt files are only synced when a `.txt` file's projection contains a link to them.

## What behavior is changing?

Nothing in this change.

## What behavior is being removed?

Nothing in this change.

## What stays the same?

Everything. This spec is a named placeholder. The projection layer does not exist yet and is not built as part of `sync-txt-files`.
