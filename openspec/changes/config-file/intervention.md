# Intervention: config-file

## Intervention type

create

## What are we intervening in?

Configuration system - a new center that allows users and developers to customize CLI behavior without code changes. Currently doesn't exist; all configuration is hardcoded in source.

## Claim

Adding a configuration file system will:
1. Enable users to customize watch directory and sync behavior without rebuilding
2. Make testing easier by allowing test configs without code changes
3. Reduce friction for multi-device setup (each device can have its own config)
4. Surface what is configurable vs what is invariant in the system

## What made us do this?

Hardcoded values create friction:
- Users can't change watch directory without modifying code
- Testing different debounce intervals requires code edits
- Each device needs to hardcode its own owner ID
- No way to customize conflict file naming or logging
- Deployment requires rebuilding for environment changes

This violates the principle that users should control their local environment. Configuration should be as local and flexible as the filesystem itself.

## What are our load-bearing assumptions?

1. **Configuration must be per-device, not synced** - each device has its own watch directory, debounce preferences, and identity. Syncing config would violate device autonomy.

2. **Invalid config should fail fast** - better to refuse to start than operate with dangerous values. Filesystem is canonical means we can't risk corrupting it with bad config.

3. **Defaults must enable core behavior** - if config is missing, system should work with reasonable defaults. Config is customization, not requirement.

## Spec files this intervention touches

- specs/config-loading/spec.md - new capability for loading and validating config
- specs/config-schema/spec.md - defines what can be configured and constraints
- specs/cli-initialization/spec.md - existing CLI startup modified to load config

## Co-variance: what else might this touch?

- **CLI startup flow** - must load and validate config before starting sync loops
- **Testing infrastructure** - tests will need to provide or mock config
- **Documentation** - users need to know what can be configured and how
- **Error messages** - must communicate config errors clearly
- **Device identity** - owner ID moves from hardcode to config file
