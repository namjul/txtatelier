# Gesture: display-deployed-commit-hash

## Gesture type
strengthen

## What are we gesturing toward?
settings-ui

## Claim
Users testing the PWA will be able to identify the exact deployed commit hash within 5 seconds of opening the settings panel, eliminating confusion about which version they're testing.

## What made us do this?
When testing the PWA deployed to GitHub Pages, there's no visible way to tell which commit is currently running. This creates uncertainty when verifying that recent changes have actually been deployed and are live.

## Load-bearing assumptions
1. The commit hash is available at build time through environment variables or git commands
2. The settings panel is the appropriate place for version/debug information
3. Displaying the hash (not a full version string) is sufficient for identifying commits

## Structures this gesture touches
- structures/pwa-settings/
- structures/build-info/

## Co-variance
- May reveal need for additional build metadata (timestamp, branch name)
- Could lead to "check for updates" functionality if users notice stale versions
