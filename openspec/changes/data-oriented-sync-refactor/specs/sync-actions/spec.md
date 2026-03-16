## ADDED Requirements

### Requirement: Sync actions are discriminated unions
All sync operations SHALL be represented as discriminated union types with a literal `type` field. Each action type MUST have a unique string literal for its type discriminator.

#### Scenario: Action has type discriminator
- **WHEN** any sync action is created
- **THEN** action has `type` field with unique string literal value

#### Scenario: TypeScript exhaustiveness checking works
- **WHEN** switch statement handles all action types
- **THEN** TypeScript compiler ensures all cases are covered (no missing cases)

### Requirement: Actions are grouped by responsibility
Actions SHALL be organized into logical groups: FileSystemAction (disk I/O), EvoluAction (database), StateAction (tracking), MetaAction (logging/skipping).

#### Scenario: Filesystem actions group together
- **WHEN** reviewing action types
- **THEN** WRITE_FILE, DELETE_FILE, CREATE_CONFLICT are grouped as FileSystemAction

#### Scenario: Evolu actions group together
- **WHEN** reviewing action types
- **THEN** INSERT_EVOLU, UPDATE_EVOLU, MARK_DELETED_EVOLU are grouped as EvoluAction

### Requirement: Actions validated with Evolu Type system
Action types SHALL be validated using Evolu's `object()` and `literal()` types. Runtime validation MUST be available via `.from()` method.

#### Scenario: Action type has Evolu Type definition
- **WHEN** defining WRITE_FILE action
- **THEN** corresponding Evolu Type object validates type, path, content, hash fields

#### Scenario: Invalid action fails validation
- **WHEN** action has missing or wrong-typed field
- **THEN** Evolu Type `.from()` returns error Result with typed error

### Requirement: Actions contain all data needed for execution
Each action SHALL contain all information required to execute that operation. Executor MUST NOT need to query additional state to perform action.

#### Scenario: WRITE_FILE contains path and content
- **WHEN** executor receives WRITE_FILE action
- **THEN** action contains path and content (no additional queries needed)

#### Scenario: CREATE_CONFLICT contains all conflict data
- **WHEN** executor receives CREATE_CONFLICT action
- **THEN** action contains originalPath, conflictPath, content, ownerId (no additional queries needed)

### Requirement: Action plans support multiple actions
Planning functions SHALL return arrays of actions when multiple operations are required. Actions in a plan MUST execute in sequence.

#### Scenario: Conflict generates multiple actions
- **WHEN** conflict is detected
- **THEN** plan includes [CREATE_CONFLICT, SET_TRACKED_HASH] actions

#### Scenario: File deletion generates multiple actions
- **WHEN** file deleted on disk
- **THEN** plan includes [MARK_DELETED_EVOLU, CLEAR_TRACKED_HASH] actions
