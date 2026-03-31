# Design: display-deployed-commit-hash

## Approach
Embed the git commit SHA during the GitHub Actions build process via environment variable, expose it to the Vite build as a `import.meta.env` variable, and display it in the PWA settings panel.

The flow:
1. GitHub Actions workflow sets `VITE_COMMIT_SHA` to `github.sha` (or short hash)
2. Vite exposes this via `import.meta.env.VITE_COMMIT_SHA`
3. Settings component reads this value and displays it alongside other settings

## Rationale
- **Build-time injection vs runtime:** Commit hash is static for a given deployment, so build-time is correct. No need for runtime git operations.
- **GitHub Actions env var vs vite-plugin-git:** Using the native `github.sha` context is simpler than adding a plugin dependency.
- **Settings panel vs main UI:** Version info is primarily for debugging/verification, not daily use. Settings is the appropriate location.

## Load-bearing assumptions
1. GitHub Actions provides `github.sha` in the workflow context
2. Vite properly passes env vars prefixed with `VITE_` to the client build
3. The settings panel has an appropriate location for this metadata

## Risks and trade-offs
- **Short hash (7 chars) vs full SHA:** Using short hash for readability, but could theoretically collide (extremely unlikely with 7 chars in this project's scale)
- **Build-time only:** If someone builds locally without the env var, they'll see `undefined` or a fallback
- **No automatic "check for updates":** This only displays current version, doesn't alert users to new deployments

## Out of scope
- Automatic update detection or notification
- Full semantic versioning (version numbers like "v1.2.3")
- Build timestamp display
- Branch name display

## Known unknowns
- Exact UI placement in the settings panel (may need adjustment during implementation)
- Whether to show short (7 char) or full (40 char) hash
- Fallback display when env var is not set (development builds)

## Co-variance
- `.github/workflows/pwa-pages.yml` - needs modification to set env var
- `centers/pwa/vite.config.ts` - may need verification of env prefix configuration
- `centers/pwa/src/settings/` - where the UI change will be made

## ⚠ Design warnings

### Responsiveness
No concerns - this is static display only, no user action required.

### Continuity after correction
Not applicable - no user corrections involved in this feature.

### Exploratory capacity
No concerns - this doesn't constrain user exploration, just adds information.
