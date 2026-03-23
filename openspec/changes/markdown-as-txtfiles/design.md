# Design: markdown-as-txtfiles

## Approach

Modify the `isTxtFile` function in `change-capture-plan.ts` to accept both `.txt` and `.md` extensions. The function will be renamed to `isTextFile` to reflect the broader scope, or keep the name but expand the check.

The change is minimal:
1. Update the extension check from `=== ".txt"` to an allowlist containing both extensions
2. Update the log message from "non-txt file" to "non-text file" (or keep it, the message is debug-level anyway)

## Why this approach?

This is the minimal viable change. The existing filter is already extension-based and operates at the exact point where we need to intervene. Creating a more generic filter system or configuration would be premature optimization — we only need two extensions now.

Alternative considered: Making the filter configurable. Rejected because:
- No evidence users need more extensions
- Adds complexity (config parsing, validation, UI)
- Can be added later if needed

## What are our load-bearing assumptions about the approach?

1. **Extension check is sufficient**: No need for content-type sniffing or magic bytes — the extension is enough to identify text files we care about
2. **No breaking changes**: Existing `.txt` files continue to work identically
3. **No migration needed**: The change only affects newly-discovered files; existing records in Evolu are unaffected

## Risks and trade-offs

- **Risk**: Users might start putting non-text content in `.md` files (e.g., binary data with wrong extension). Mitigation: The sync system treats all content as opaque bytes — it won't break, just sync garbage.
- **Trade-off**: We're hardcoding two extensions. If users need `.markdown`, `.rst`, `.org`, etc., we'll need another change.

## What we are not doing

- Not creating a configurable extension list
- Not adding content-type detection
- Not validating that `.md` files contain valid markdown
- Not treating `.md` differently from `.txt` anywhere in the pipeline

## Known unknowns

None. The scope is narrow and the path is clear.

## Co-variance: what else might this touch?

- `startup-reconciliation.ts` — uses `isTxtFile` for the same filtering logic
- Tests that specifically check for `.txt` extension behavior
- Documentation that mentions "only .txt files are synced"

## ⚠ Design warnings

### Responsiveness
No change. The filter runs synchronously during plan computation — same performance characteristics.

### Continuity after correction
N/A — this change doesn't affect error recovery or correction paths.

### Exploratory capacity
N/A — this change only expands what files are visible to the system, it doesn't constrain exploration.
