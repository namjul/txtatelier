# Contact Test: file-projection

## Evidence tier

proximal — we use the system ourselves and directly observe projection output

## What would success look like?

Given a `.txt` file containing `[[some/path.txt]]`, the projection returns that path in its links array. Given a file whose first line is `My Note Title`, the projection returns that string as its title. Given two files where file A links to file B, a query for file B returns file A in its backlinks. All of this is observable by running the CLI against a real watch directory.

## What would falsify this claim?

- A file with a `[[...]]` link that does not appear in the projection's links array after content is parsed.
- A file whose first non-empty line is not returned as title.
- A backlinks query that misses a file known to link to the target.
- Parsing crashes or produces empty projections on files with no links.
- After renaming a file, a linking file still contains the old `[[path]]` on disk.

## How will we check?

Write three example `.txt` files in a test watch directory — one with no links, one with one `[[...]]` link, one with multiple links and a title. Run the CLI, inspect projection output directly (log or query). Check that links and titles match expectations. Then rename the linked file and verify the linking file's content is rewritten to use the new path.

## When will we check?

Immediately after the first passing implementation — before merging. The check is part of the implementation task, not deferred.
