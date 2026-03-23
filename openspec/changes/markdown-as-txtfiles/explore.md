# Explore: markdown-as-txtfiles

## What we are noticing

Users write in `.md` files. The current `isTxtFile` filter accepts only `.txt`, so `.md` files are completely invisible to the sync system. But a markdown file is just text — there is no reason the sync layer needs to treat it differently. The content is stored raw; no parsing happens at capture time.

The `txt-file-filter` spec explicitly named `.md` as a rejected extension. That decision was about keeping scope narrow at the time, not because markdown files are structurally incompatible.

Additionally, users should be able to configure their preferred default file type — either markdown (`.md`, without TOML/YAML front matter) or plain-text (`.txt`). The `config-file` change already established the config system; this setting would be a natural addition to it.

## What we don't understand

- Is there any part of the existing pipeline (projection, conflict detection, rename detection) that would behave incorrectly if it received a `.md` path instead of a `.txt` path?
- What does "default file type" control exactly — the extension used when the system creates new files, or something else?
- Should display/UI layers also consume the default file type setting?

## What we want to poke at

- Check all the places `isTxtFile` is used and whether its callers assume `.txt` specifically.
- Check the `file-projection` layer — title extraction strips `#`, which already works for markdown headings. Verify there's no `.txt`-specific logic there.
- Review the `config-file` spec to confirm where a `defaultFileType` setting would fit in the config schema.

## What would make this worth a full intervention

If the only changes needed are: (1) extend the extension allowlist to include `.md`, and (2) add a `defaultFileType` config option (`"txt"` | `"md"`) — and the rest of the pipeline is already format-agnostic — that's sufficient to proceed. There is no planned markdown parser and no frontmatter parsing. Any future custom parser will apply equally to both `.txt` and `.md` files.
