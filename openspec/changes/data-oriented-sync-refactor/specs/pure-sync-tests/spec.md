## ADDED Requirements

### Requirement: Planning functions tested without I/O
Planning function tests SHALL construct state objects directly and test planning logic in isolation. Tests MUST NOT perform filesystem operations, database queries, or require async infrastructure.

#### Scenario: Test constructs state directly
- **WHEN** testing planChangeCapture
- **THEN** test creates FileState object with literal values (no I/O)

#### Scenario: Test runs synchronously
- **WHEN** testing pure planning function
- **THEN** test completes in <10ms (no async delays, no I/O waits)

### Requirement: Tests cover all sync decision branches
Planning function tests SHALL cover all decision paths: file unchanged, file modified, file deleted, new file, conflict detected, safe to apply.

#### Scenario: Test file unchanged path
- **WHEN** diskHash equals evolHash
- **THEN** plan includes SKIP action with "hash-matches" reason

#### Scenario: Test conflict detection path
- **WHEN** diskHash, lastAppliedHash, and evolHash all differ
- **THEN** plan includes CREATE_CONFLICT action

#### Scenario: Test safe write path
- **WHEN** no conflict detected and file changed
- **THEN** plan includes WRITE_FILE action

### Requirement: Tests validate action structure
Planning function tests SHALL assert on exact action structure (type, fields, values). Tests MUST verify complete action plans (all actions in sequence).

#### Scenario: Test verifies action type
- **WHEN** testing deletion scenario
- **THEN** test asserts action.type === "MARK_DELETED_EVOLU"

#### Scenario: Test verifies action fields
- **WHEN** testing file write
- **THEN** test asserts action has correct path, content, hash

#### Scenario: Test verifies action sequence
- **WHEN** conflict creates multiple actions
- **THEN** test asserts plan contains [CREATE_CONFLICT, SET_TRACKED_HASH] in order

### Requirement: Tests use Evolu Type validation
Tests SHALL use Evolu Type system to validate state and action structures. Tests MAY use `.from()` to ensure constructed test data is valid.

#### Scenario: Test validates state with Evolu Type
- **WHEN** test constructs FileState
- **THEN** test validates state with FileState.from() to ensure valid structure

#### Scenario: Test validates action with Evolu Type
- **WHEN** planning function returns actions
- **THEN** test MAY validate actions with SyncAction.from() for type safety

### Requirement: Integration tests remain unchanged
Existing integration tests SHALL continue to pass after refactor. Integration tests MUST validate same end-to-end behavior (filesystem + Evolu sync).

#### Scenario: File sync integration test passes
- **WHEN** file created on disk
- **THEN** existing test verifies file syncs to Evolu (full I/O flow)

#### Scenario: Conflict integration test passes
- **WHEN** file modified in both places
- **THEN** existing test verifies conflict file created (full I/O flow)

### Requirement: Unit tests provide fast feedback
Planning function unit tests SHALL run in <10ms each. Full unit test suite MUST complete in <1 second.

#### Scenario: Single unit test is fast
- **WHEN** running one planning function test
- **THEN** test completes in <10ms

#### Scenario: Full unit test suite is fast
- **WHEN** running all planning function tests
- **THEN** suite completes in <1 second
