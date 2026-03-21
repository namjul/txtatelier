# Explore: config-file

## What we are noticing

The CLI currently has hardcoded values for critical parameters:
- Watch directory path (currently `watchDir` in code)
- Debounce intervals (file watch, Evolu subscription)
- Conflict file naming patterns
- Device identity/owner ID

Each change to these values requires code modification, rebuild, and redeployment. There's no way for users to customize behavior without modifying source code.

## What we don't understand

- What parameters users will actually want to configure vs what should remain fixed?
- Should configuration be per-device or synced across devices via Evolu?
- How does configuration interact with the "filesystem is canonical" principle?
- Where should the config file live - in the watch directory or separate?
- What happens if config file is malformed or missing?
- Should the PWA share configuration with CLI or maintain separate config?

## What we want to poke at

Read through the current codebase to identify all hardcoded values that might need configuration. List them categorically:
- Critical (required for operation): watch directory, owner ID
- Tuning (performance): debounce intervals, batch sizes
- Convention (user preference): conflict naming, log levels
- Dangerous (could break invariants): hash algorithm, sync loop behavior

## What would make this worth a full intervention

If we find:
1. At least 5 distinct parameters that users would reasonably want to configure
2. Evidence that hardcoded values create friction for testing or deployment
3. A clear separation between "safe to configure" vs "invariant to protect"

Then we have enough understanding to make a falsifiable claim about what configuration system would strengthen the system.
