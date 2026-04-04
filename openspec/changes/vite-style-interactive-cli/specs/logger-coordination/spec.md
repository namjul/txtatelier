# logger-coordination (delta)

## ADDED Requirements

### Requirement: Interactive logger coordinates with readline

When a readline interface is active, log lines SHALL clear the current prompt row, write the message, then redraw the prompt so streaming logs do not corrupt the input line.

#### Scenario: Log during prompt

- **WHEN** sync logs arrive while the user is at the `> ` prompt
- **THEN** the prompt is redrawn after each coordinated log line

### Requirement: Viewport clear preserves scrollback

`clearScreen` (shortcut `c`) SHALL use `readline.cursorTo` and `readline.clearScreenDown` on stdout when safe. It SHALL NOT run when stdout or stderr has already written bytes (piped or scripted prior output), so existing scrollback context is preserved.

#### Scenario: Fresh TTY

- **WHEN** stdout and stderr have written zero bytes and stdout is a TTY
- **THEN** clear moves the cursor to the top and clears below, leaving scrollback intact

#### Scenario: Prior output

- **WHEN** stdout or stderr `bytesWritten` is greater than zero
- **THEN** clear is a no-op

### Requirement: Startup banner

After sync is ready, the CLI SHALL print a banner line of the form `TXTAELIER v<version>  ready in <duration>` where duration uses milliseconds when under one second and seconds with one decimal otherwise. When `clear: true` and viewport clear is allowed, the banner print MAY clear the viewport first.

#### Scenario: Sub-second start

- **WHEN** startup completes in under 1000 ms
- **THEN** the banner uses a `ms` duration (e.g. `840 ms`)
