# Tasks: file-projection

## Implementation

### 1. Define the projection type and module

- [ ] 1.1 Create `centers/cli/src/file-sync/projection.ts` with the `FileProjection` type and `projectContent(content: string): FileProjection` function
- [ ] 1.2 Implement title extraction: first non-empty line, strip leading `#` and whitespace
- [ ] 1.3 Implement desc extraction: up to ~160 chars from subsequent non-empty lines after the title
- [ ] 1.4 Implement link extraction: regex `/\[\[([^\]]+)\]\]/g` over full content, collect inner paths trimmed of whitespace
- [ ] 1.5 Implement `backlinksFor(path: string, projections: Map<string, FileProjection>): string[]` — linear scan returning paths whose links include the target

### 2. Link rewriting on rename

- [ ] 2.1 Add `rewriteLinks(content: string, oldPath: string, newPath: string): string` to `projection.ts` — replaces all `[[oldPath]]` with `[[newPath]]`, returns content unchanged if no match
- [ ] 2.2 Integrate into rename executor: after updating the Evolu row path, load all `.txt` file contents, call `backlinksFor` to find affected files, call `rewriteLinks` on each, write changed files back to disk
- [ ] 2.3 Ensure rewritten files go through the normal write path (watcher will pick them up as content-change events)

### 3. Tests

- [ ] 3.1 Unit test: file with no content → empty title, empty desc, empty links
- [ ] 3.2 Unit test: file with a title line only → correct title, empty desc, empty links
- [ ] 3.3 Unit test: file with title + body → correct title and desc
- [ ] 3.4 Unit test: file with one `[[path/to/file.txt]]` → links contains `path/to/file.txt`
- [ ] 3.5 Unit test: file with multiple sigils → all paths collected
- [ ] 3.6 Unit test: `backlinksFor` returns correct paths given a set of projections
- [ ] 3.7 Unit test: heading-style title (`# My Title`) → title is `My Title` (no leading `#`)
- [ ] 3.8 Unit test: `rewriteLinks` replaces `[[old.txt]]` with `[[new.txt]]` in content
- [ ] 3.9 Unit test: `rewriteLinks` returns content unchanged when old path not present
- [ ] 3.10 Unit test: `rewriteLinks` replaces all occurrences (multiple links to same path)

### 4. Contact test (manual)

- [ ] 4.1 Create three example `.txt` files in a test watch directory: one with no links, one with a `[[...]]` link, one with multiple links and a heading title
- [ ] 4.2 Call `projectContent` on each and verify output matches expected title, desc, and links
- [ ] 4.3 Verify `backlinksFor` returns correct results across the three files
- [ ] 4.4 Rename the linked file; verify the linking file's content is rewritten on disk with the new path

## Co-variance notes

<!-- Add notes here as you work through implementation -->

## Load-bearing assumptions that didn't hold

<!-- Add here if any design assumptions proved wrong during implementation -->
