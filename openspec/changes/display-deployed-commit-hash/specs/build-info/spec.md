## ADDED Requirements

### Requirement: GitHub Pages workflow injects short commit SHA for PWA build

The Deploy PWA to GitHub Pages workflow SHALL set `VITE_COMMIT_SHA` for the `bun run build` step to the first seven hexadecimal characters of the commit being built (`GITHUB_SHA`), so the deployed bundle matches the repository revision.

#### Scenario: CI build

- **WHEN** the workflow runs the Build PWA step on GitHub Actions
- **THEN** `VITE_COMMIT_SHA` is exported as a seven-character prefix of `GITHUB_SHA` before invoking `bun run build`

#### Scenario: TypeScript surface

- **WHEN** application code references `import.meta.env.VITE_COMMIT_SHA`
- **THEN** the PWA workspace declares the variable on `ImportMetaEnv` for type checking
