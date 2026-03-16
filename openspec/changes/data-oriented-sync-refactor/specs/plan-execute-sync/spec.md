## ADDED Requirements

### Requirement: Planning functions are pure and deterministic
Planning functions SHALL accept state as input and return action plans without performing any I/O operations. Given the same state input, a planning function MUST always return the same action plan.

#### Scenario: Same state produces same plan
- **WHEN** planning function is called twice with identical FileState
- **THEN** both invocations return identical action plans (same actions, same order)

#### Scenario: Planning function performs no I/O
- **WHEN** planning function executes
- **THEN** no filesystem operations, database queries, or network calls occur

### Requirement: Action plans are returned as immutable data
Planning functions SHALL return action plans as readonly arrays of action objects. Action plans MUST NOT be mutated after creation.

#### Scenario: Action plan is readonly array
- **WHEN** planning function returns action plan
- **THEN** return type is `readonly SyncAction[]`

#### Scenario: Actions cannot be mutated
- **WHEN** attempting to modify an action in a plan
- **THEN** TypeScript compiler prevents mutation (compile-time error)

### Requirement: Execution is separated from planning
Execution layer SHALL accept action plans and perform side effects (I/O operations). Executor MUST NOT contain business logic or decision-making - it only dispatches actions.

#### Scenario: Executor performs I/O for actions
- **WHEN** executor receives WRITE_FILE action
- **THEN** executor writes file to disk via filesystem API

#### Scenario: Executor contains no business logic
- **WHEN** executor processes actions
- **THEN** no conditional logic for sync decisions (only action dispatch based on action.type)

### Requirement: Three sync modules use plan-execute pattern
Change capture, state materialization, and startup reconciliation SHALL all follow plan-execute pattern: collect state → plan actions → execute plan.

#### Scenario: Change capture follows pattern
- **WHEN** file changes on disk
- **THEN** state collector gathers disk/Evolu state, planner generates actions, executor applies them

#### Scenario: State materialization follows pattern
- **WHEN** Evolu row changes
- **THEN** state collector gathers disk/Evolu state, planner generates actions, executor applies them

#### Scenario: Startup reconciliation follows pattern
- **WHEN** CLI starts up
- **THEN** state collector gathers all file states, planner generates actions for each, executor applies them
