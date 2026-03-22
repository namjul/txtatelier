# Explore: sync-txt-files

## What we are noticing

The current sync treats all non-ignored files equally: any file that passes the ignore filter (dotfiles, temp files, system files) gets synced into Evolu as a `File` record. There is no notion of what _kind_ of file is meaningful to the app.

txtatelier is fundamentally a tool for working with text files. The app has a concept of a text format — blocks of lines, sigil-prefixed special blocks, empty lines ignored — and `.txt` is the natural first concrete extension for that format. But right now the sync has no awareness of this distinction.

The ignore system (`ignore.ts`) operates as a denylist: specific patterns are excluded. There is no allowlist of what should positively be included.

## What we don't understand

- What happens to non-txt files that are currently synced? Are they ever rendered or used? Or do they silently accumulate as inert records in Evolu?
- If we restrict sync to `.txt` only at the capture layer, does state-materialization also need to be scoped? Or does it follow naturally (only `.txt` records exist, so only `.txt` gets written)?
- How does the future "link to same-origin files" model interact with this? Linked files of any format will be synced, but only because a `.txt` file pointed to them. Does that mean non-txt files need a separate, secondary sync path — or a flag on the `File` record indicating why it was included?
- Should the `.txt` filter apply at the watcher level, the change-capture-plan level, or both?

## What we want to poke at

- Read `change-capture-plan.ts` and `watch.ts` to find the exact decision points where a file is accepted or rejected — understand where a txt-only filter would slot in most cleanly.
- Check whether state-materialization scopes itself based on what's in Evolu, or whether it independently scans the filesystem. If it scans independently, it may also need a txt filter.
- Consider: if a user has a watched directory with 500 image files and 10 `.txt` files, what does startup reconciliation currently do with those 500 images? After this change, they should be invisible.

## What would make this worth a full intervention

The case is already clear enough to proceed: the app's identity is text files, `.txt` is the unambiguous starting point, and there is a concrete future model (linked files) that explains how non-txt files re-enter the picture later. The open question is whether the filter belongs at one layer or two (watcher + plan), and whether state-materialization needs a symmetric filter. Answering that through a brief code read is the remaining investigation before writing a gesture.
