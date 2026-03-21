# Contact Test: add-txtatelier-log-level

## Evidence tier
proximal — I will use the system with different log levels and verify the behavior

## What would success look like?

**ERROR level (default):**
- Only error messages appear (WebSocket failures, sync errors, file I/O errors)
- Normal operation produces zero output
- Critical issues immediately visible

**INFO level:**
- Shows: "Initializing...", "Ready", "Watching directory: /path", "Owner ID: xxx"
- Shows completion summaries: "Completed N files in Xs"
- Does NOT show: individual file operations, hash matches, debounce resets
- Can follow high-level system flow without noise

**DEBUG level:**
- Shows all INFO messages
- PLUS: individual file sync decisions, hash comparisons, subscription timing
- Can trace exactly why a file was/wasn't synced
- Output is searchable/filterable for specific files

**Variable parsing:**
- `TXT_ATELIER_LOG_LEVEL=ERROR` → ERROR level
- `TXT_ATELIER_LOG_LEVEL=INFO` → INFO level  
- `TXT_ATELIER_LOG_LEVEL=DEBUG` → DEBUG level
- Unset or invalid → defaults to ERROR

## What would falsify this claim?

1. ERROR level shows non-error messages (too noisy)
2. INFO level shows individual file operations (not minimal enough)
3. DEBUG level is missing critical diagnostic information
4. Log levels have no effect (all messages show regardless)
5. Invalid values crash the application

## How will we check?

**Test 1: ERROR level behavior**
```bash
unset TXT_ATELIER_LOG_LEVEL
# or
TXT_ATELIER_LOG_LEVEL=ERROR bun run cli
# Verify: only errors appear
```

**Test 2: INFO level minimalism**
```bash
TXT_ATELIER_LOG_LEVEL=INFO bun run cli
# Verify: lifecycle events visible, file operations hidden
```

**Test 3: DEBUG level usefulness**
```bash
TXT_ATELIER_LOG_LEVEL=DEBUG bun run cli
# Verify: can see file sync decisions and timing
# Create a test file, verify DEBUG shows the decision path
```

**Test 4: Edge cases**
- Invalid values → should default to ERROR
- Case sensitivity → should accept "debug", "DEBUG", "Debug"

## When will we check?

Immediately after Phase 1 implementation (log level infrastructure + initial reclassification of logs to DEBUG).

Phase 2 (fine-tuning DEBUG logs) will be evaluated after 1 week of usage.
