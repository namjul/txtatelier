# owner-management (delta)

## ADDED Requirements

### Requirement: Owner operations on the live session

`FileSyncSession` SHALL expose `showMnemonic`, `showStatus`, `restoreMnemonic(readLine)`, and `resetOwner` for the running sync session. `showMnemonic` SHALL print the mnemonic to logs for manual copy (no clipboard). `restoreMnemonic` SHALL read words from the provided `readLine` function, validate them, persist the restored owner, flush, and invoke `restart()` so the new owner is active without a separate process. `resetOwner` SHALL reset the persisted owner, flush, and invoke `restart()` immediately without an extra confirmation prompt.

#### Scenario: Restore after paste

- **WHEN** the user invokes `p` + Enter and pastes a valid mnemonic at the prompt
- **THEN** the owner is restored and sync restarts under the restored identity

#### Scenario: Reset without confirmation

- **WHEN** the user invokes `d` + Enter
- **THEN** the owner is reset and sync restarts with no interactive confirm step

### Requirement: Non-interactive owner subcommand

The `txtatelier owner` subcommand with `--show`, `--where`, and `--reset --yes` SHALL remain available for scripts and non-TTY environments.

#### Scenario: Scripted show

- **WHEN** the user runs `txtatelier owner --show` without a TTY
- **THEN** the mnemonic is printed to stdout and the process exits
