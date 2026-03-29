# startup-validation (delta)

## ADDED Requirements

### Requirement: CLI startup order before sync

For the default `txtatelier` command, the system SHALL resolve the watch directory, acquire the instance lock, then run file-sync initialization (Evolu client, reconciliation, sync loops). Fatal failures before sync begins SHALL not leave the lock held when startup fails after lock acquisition.

#### Scenario: Happy path order

- **WHEN** the user starts the CLI with valid configuration
- **THEN** the watch directory is resolved first
- **THEN** the instance lock is acquired
- **THEN** `startFileSync` runs with that same resolved watch directory

#### Scenario: Lock held but sync startup fails

- **WHEN** the instance lock was acquired but `startFileSync` returns a fatal error
- **THEN** the CLI releases the lock before exiting with a non-zero code other than 2

#### Scenario: Duplicate instance exits before Evolu

- **WHEN** the instance lock cannot be acquired
- **THEN** the CLI exits with code 2 without initializing Evolu for that start
