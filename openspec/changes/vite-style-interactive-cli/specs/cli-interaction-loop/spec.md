# cli-interaction-loop (delta)

## ADDED Requirements

### Requirement: TTY-gated readline shortcuts

The CLI SHALL detect interactive stdin using `process.stdin.isTTY` and absence of a truthy `CI` environment value. When interactive, the CLI SHALL bind a single readline interface with an empty visible prompt and SHALL accept single-letter commands followed by Enter (`h`, `r`, `u`, `s`, `p`, `d`, `c`, `q`). When not interactive, the CLI SHALL log that shortcuts are disabled and SHALL NOT create a readline interface.

#### Scenario: Foreground terminal

- **WHEN** the user runs the default start command in a TTY with `CI` unset
- **THEN** the process prints a startup banner and a hint to press `h` + Enter for help
- **THEN** readline accepts shortcut lines after the prompt

#### Scenario: Background or CI

- **WHEN** stdin is not a TTY or `CI` is set to a truthy sentinel
- **THEN** the process logs `Running non-interactive (shortcuts disabled)`
- **THEN** no readline interface is bound for shortcuts

### Requirement: Shortcut semantics

The CLI SHALL map shortcuts as follows: `r` restart sync, `u` status, `s` show mnemonic for manual copy, `p` restore mnemonic from a prompted line, `d` reset owner immediately without confirmation, `c` clear the visible viewport without destroying scrollback, `q` quit, `h` help listing shortcuts. The CLI SHALL ignore unknown single-letter input without exiting.

#### Scenario: Help

- **WHEN** the user submits `h` + Enter
- **THEN** the CLI prints a help block listing all shortcuts including the restart reconciliation note

### Requirement: Shortcut error policy

When a shortcut action throws or rejects, the CLI SHALL log the error to stderr and SHALL exit the process with code `1` without attempting session recovery.

#### Scenario: Failing restart

- **WHEN** a shortcut handler rejects (e.g. restart reconciliation fails fatally)
- **THEN** the process exits with code `1`

### Requirement: Readline survives in-process restart

The readline interface used for shortcuts SHALL be created once at composition root and SHALL remain open across `FileSyncSession.restart()` calls; restart SHALL only stop and reattach filesystem watchers and state materialization, not recreate readline.

#### Scenario: Restart from shortcut

- **WHEN** the user invokes `r` + Enter
- **THEN** the same readline instance continues to accept lines after restart completes

### Requirement: Concurrent shortcut guard

While one shortcut action is running, additional line events SHALL be ignored until the action completes.

#### Scenario: Re-entrancy

- **WHEN** a shortcut is slow and the user submits another command before it finishes
- **THEN** the second command is ignored until the first completes
