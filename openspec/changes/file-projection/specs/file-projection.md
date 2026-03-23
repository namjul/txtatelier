# Delta Spec: file-projection

## What behavior is being added?

The `file-projection` capability is implemented. Given a `.txt` file's content, the system derives a projection with:

- **title** — the first non-empty line of the file's content, trimmed of leading `#` characters and whitespace
- **desc** — a short excerpt taken from the subsequent non-empty lines after the title (up to ~160 chars), trimmed
- **links** — an array of paths extracted from `[[path]]` sigils anywhere in the file body
- **backlinks** — derived at query time by scanning all projections for links that point to the current file path; not stored, not indexed

The sigil syntax is `[[path]]` where `path` is a relative file path. Whitespace inside the brackets is stripped. A file with no `[[...]]` sigils has an empty links array. A file with no first line has an empty string title.

`createdAt` and `updatedAt` are already auto-columns on the `file` table (provided by Evolu); this change makes no schema modifications for those fields.

## What behavior is changing?

The `file-projection` stub in `sync-txt-files/specs/file-projection.md` named this capability without implementing it. After this change the capability exists and produces real output. The sigil syntax (`[[path]]`) is now concrete rather than undefined.

When a rename is detected by the `content-based-rename-detection` layer, the system now additionally rewrites `[[oldPath]]` sigils to `[[newPath]]` in all `.txt` files that contain them. This turns a previously silent path update into a content-preserving link migration. The rewritten files enter the normal file-sync write path — they are written to disk and picked up by the watcher as content changes.

## What behavior is being removed?

Nothing is removed.

## What stays the same?

- The `file` table schema (`id`, `path`, `content`, `contentHash`) is unchanged.
- Projection is derived from content — it is not stored as a separate table or column.
- Non-txt file sync via linked-file paths remains out of scope for this change; this change only makes the projection available so that future linked-file sync can use it.
- `parents` is out of scope.
