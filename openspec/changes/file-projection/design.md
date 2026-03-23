# Design: file-projection

## Approach

A pure module `file-sync/projection.ts` exports:

```ts
projectContent(content: string): FileProjection

rewriteLinks(content: string, oldPath: string, newPath: string): string
```

`FileProjection` is a plain object:

```ts
type FileProjection = {
  title: string;   // first non-empty line, stripped of leading '#' and whitespace
  desc: string;    // short excerpt from subsequent lines, max ~160 chars
  links: string[]; // paths extracted from [[path]] sigils
}
```

`projectContent` is stateless and has no side effects. It is called on demand wherever a caller needs structured data from file content — it is not invoked automatically on every write. Projection is never stored in the database. `createdAt` and `updatedAt` continue to come from Evolu's auto-columns.

`rewriteLinks` replaces all `[[oldPath]]` occurrences with `[[newPath]]` in the given content string. It is a pure string transformation — no I/O. Returns the original string unchanged if no match is found.

Backlinks are not stored. A `backlinksFor(path, allProjections)` utility computes them at call time by filtering projections whose `links` array contains the given path.

Link extraction uses a simple regex over `[[...]]` sigils: `/\[\[([^\]]+)\]\]/g`. No grammar library is needed.

**Rename integration**: the rename executor (in `content-based-rename-detection`) calls `backlinksFor` to find which files link to `oldPath`, then calls `rewriteLinks` on each file's content, then writes the result back to disk. The watcher picks up the changed files as normal content-change events.

## Why this approach?

- **No schema migration**: projection is derived from `content`, which is already stored. Adding columns would require a migration and could cause sync conflicts if schema versions diverge across devices.
- **Always in sync**: because projection is computed from the current content on demand, it can never be stale relative to what is on disk.
- **Simple parser**: `[[path]]` can be extracted with one regex. A grammar toolkit is appropriate when syntax is complex or ambiguous; it is premature here.
- **Backlinks as a scan**: file counts in this system are small enough that a linear scan is acceptable and avoids the complexity of a maintained index.

## What are our load-bearing assumptions about the approach?

- File counts stay small enough (hundreds, not millions) that on-demand projection and backlink scans have no perceptible latency.
- `[[path]]` is unambiguous enough that a regex is a correct parser — no edge cases that require lookahead or stateful parsing.
- Callers always have `content` available when they need projection; there is no case where projection is needed but content has not been loaded.

## Risks and trade-offs

- If projection is called inside a hot path (e.g., every keystroke on large files), parsing overhead could accumulate. The design does not memoize — callers must decide whether to cache.
- Regex-only parsing means malformed sigils (e.g., `[[path with ] inside]]`) silently produce wrong results rather than errors. This is acceptable for now.
- `desc` is a best-effort excerpt. There is no guarantee it forms a coherent sentence.

## What we are not doing

- Storing projection fields (`title`, `desc`, `links`) as database columns.
- Maintaining a backlink index or reverse-link table.
- Supporting any sigil format other than `[[path]]`.
- Implementing YAML front-matter or inline `key: value` metadata.
- Implementing `parents` (explicitly out of scope).
- Using OHM.js or any grammar toolkit.
- Triggering projection automatically on every file write.
- Rewriting links in non-txt files (only `.txt` files contain `[[...]]` sigils).

## Known unknowns

- Where in the call graph will `projectContent` first be invoked? The design leaves this to implementation — the module is ready to be called wherever it is needed.
- Should `links` paths be normalized (resolved to absolute paths, or kept as written in the sigil)? To be decided during implementation; keeping them as written is the default.
- Does `rewriteLinks` need to handle partial path matches (e.g., `[[notes]]` vs `[[notes.txt]]`)? Default assumption: exact string match only.

## Co-variance: what else might this touch?

- `evolu-queries.ts` — if a query needs title or links, it will call `projectContent` on the content column it already retrieves.
- Rename executor (`content-based-rename-detection`) — gains a new step after path update: load all `.txt` file contents, call `backlinksFor` + `rewriteLinks`, write changed files back to disk.
- Future linked-file sync — consumes `links` from projection to determine which non-txt files to sync.
- Future UI display — consumes `title` and `desc` for file list rendering.

## Design warnings

### Responsiveness

Projection is computed on demand and synchronously. For the current file sizes, this should be imperceptible. No async gap is introduced.

### Continuity after correction

Projection is stateless and derived from content. If a user corrects a `[[path]]` typo, the next projection call reflects the correction exactly. No stale state to recover from.

### Exploratory capacity

The `[[path]]` sigil is intentionally simple. Users can discover it by reading any file that uses it. The design does not introduce any hidden syntax or mode.
