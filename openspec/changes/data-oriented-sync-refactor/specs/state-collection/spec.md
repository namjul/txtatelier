## ADDED Requirements

### Requirement: State structures are plain readonly data
State structures SHALL be defined as TypeScript interfaces with readonly fields. State MUST NOT contain methods or behavior - only data.

#### Scenario: FileState is readonly interface
- **WHEN** FileState is defined
- **THEN** all fields are marked readonly

#### Scenario: State contains no methods
- **WHEN** reviewing state interfaces
- **THEN** no methods or functions are present (data only)

### Requirement: State collectors return Result types
State collector functions SHALL return `Result<State, Error>` to handle I/O failures. Collectors MUST handle all I/O errors and convert them to typed error Results.

#### Scenario: Successful state collection
- **WHEN** state collector gathers state successfully
- **THEN** returns `{ ok: true, value: State }`

#### Scenario: Failed state collection
- **WHEN** filesystem read fails during collection
- **THEN** returns `{ ok: false, error: TypedError }` (no thrown exceptions)

### Requirement: State collectors gather complete snapshots
State collectors SHALL gather all information needed for planning in a single call. Planning functions MUST NOT need to perform additional I/O.

#### Scenario: ChangeCaptureState has disk and Evolu data
- **WHEN** collectChangeCaptureState runs
- **THEN** returned state includes diskHash, diskContent, evolHash, evolId (complete snapshot)

#### Scenario: MaterializationState has tracking data
- **WHEN** collectMaterializationState runs
- **THEN** returned state includes diskHash, evolHash, evolContent, lastAppliedHash, ownerId (complete snapshot)

### Requirement: State collectors handle missing data
State collectors SHALL use null for missing data (file doesn't exist, no Evolu record). Collectors MUST distinguish between "data doesn't exist" (null) and "failed to read data" (error Result).

#### Scenario: File doesn't exist on disk
- **WHEN** file doesn't exist
- **THEN** diskHash is null and diskContent is null (not an error)

#### Scenario: No Evolu record exists
- **WHEN** file not in Evolu database
- **THEN** evolHash is null and evolId is null (not an error)

#### Scenario: Filesystem read fails
- **WHEN** file exists but read permission denied
- **THEN** returns error Result (not null - actual failure)

### Requirement: State validated with Evolu Type system
State structures SHALL have corresponding Evolu Type definitions. State collectors MAY use Evolu Type validation for runtime safety.

#### Scenario: FileState has Evolu Type definition
- **WHEN** FileState is defined
- **THEN** corresponding Evolu Type object validates all fields

#### Scenario: State collector validates output
- **WHEN** state collector returns state (in tests)
- **THEN** state can be validated with `.from()` method
