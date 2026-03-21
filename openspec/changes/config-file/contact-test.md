# Contact Test: config-file

## Evidence tier

soft

## What would success look like?

Success observable if:

1. **Configuration enables customization** - A developer can change watch directory, debounce interval, and owner ID by editing config file and restarting CLI, without touching source code or rebuilding.

2. **Testing becomes easier** - Test suite can provide different configs for different test scenarios without modifying code or using environment variables.

3. **Invalid config fails clearly** - When config has invalid values (negative debounce, missing watch dir), CLI refuses to start and prints clear error message identifying the problem.

4. **Defaults work** - When config file is missing optional fields, CLI starts successfully with reasonable defaults and operates normally.

5. **Multi-device setup is straightforward** - Setting up a second device requires only creating/editing config file with new owner ID, not modifying code.

## What would falsify this claim?

Observable failures:

1. **Config changes require rebuild anyway** - changing config file doesn't affect behavior without recompiling/rebuilding code.

2. **Testing still requires code changes** - tests can't use config to control behavior, still need to modify source or set globals.

3. **Errors are obscure** - invalid config produces cryptic errors or worse, silent failures where CLI starts but behaves incorrectly.

4. **Defaults don't work** - missing config causes crashes or requires providing all values explicitly.

5. **Config adds complexity without benefit** - developers avoid using config and prefer hardcoding because config system is too rigid or confusing.

## How will we check?

1. **Self-experience test** - Use config system while developing and testing. Track friction points: Does it help or create obstacles?

2. **Modification test** - Change 3 different config values (watch dir, debounce, owner ID) and verify behavior changes without rebuild.

3. **Error test** - Provide invalid config (malformed JSON, negative numbers, missing required fields) and verify clear error messages.

4. **Default test** - Start CLI with minimal config (only required fields) and verify normal operation.

5. **Second device simulation** - Set up config for "second device" (different owner ID, different watch dir) and verify both can run simultaneously without code changes.

## When will we check?

Check after implementation is complete and tested:
- 1 week of self-use during continued development
- All 5 observable success criteria must pass
- Any falsification criteria triggers revision

Timeline: 2 weeks from implementation completion.
