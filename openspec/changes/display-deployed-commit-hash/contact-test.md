# Contact Test: display-deployed-commit-hash

## Evidence tier
proximal

## What would success look like?
Opening the settings panel in the deployed PWA immediately reveals a 7-character commit hash (e.g., "ed45340") in a visible location, with the label "Version" or "Commit" nearby. I can read and copy this hash within 5 seconds.

## What would falsify this claim?
- The settings panel shows no commit hash or version information
- The displayed hash doesn't match the actual deployed commit (e.g., shows "unknown" or stale hash)
- The hash is hidden, requires scrolling, or is otherwise difficult to locate

## How will we check?
1. Deploy the PWA to GitHub Pages
2. Open the deployed app in a browser
3. Click to open the settings panel
4. Verify the commit hash is visible and matches the latest `main` branch commit
5. Time how long it takes to locate the hash (should be < 5 seconds)

## When will we check?
Immediately after the next deployment to GitHub Pages, or within 1 hour of implementing this change.
