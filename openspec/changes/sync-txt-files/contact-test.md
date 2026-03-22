# Contact Test: sync-txt-files

## Evidence tier

proximal — the behaviour is directly observable by watching what enters Evolu during a sync run.

## What would success look like?

- A watched directory containing `.txt` files alongside non-txt files (e.g. `.md`, `.png`, `.pdf`) results in only the `.txt` files appearing as `File` records in Evolu.
- Non-txt files produce no records, no errors, and no warnings during a normal sync run.
- Startup reconciliation over the same mixed directory produces the same result: only `.txt` records.
- After adding a `.md` file to the watched directory, no new record appears in Evolu.

## What would falsify this claim?

- A non-txt file appears as a `File` record in Evolu after syncing a mixed directory.
- A `.txt` file is silently dropped and does not appear in Evolu.
- The filter causes an error or crash when a non-txt file is encountered.
- State-materialization writes a non-txt file to disk that was not in Evolu before the change (would indicate the filter created an asymmetry).

## How will we check?

Run a local sync against a directory containing:
- `note.txt` — should be captured
- `readme.md` — should be ignored
- `image.png` — should be ignored
- `data.json` — should be ignored

Query Evolu (or read the log output) to confirm exactly one `File` record exists (`note.txt`) and the others left no trace.

Repeat with startup reconciliation by stopping and restarting the watcher with the same directory.

## When will we check?

Immediately after the implementation task is complete, before merging.
