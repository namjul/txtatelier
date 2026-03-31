## 1. Update GitHub Actions Workflow

- [x] 1.1 Add VITE_COMMIT_SHA environment variable to pwa-pages.yml build step
- [x] 1.2 Use short commit hash (first 7 chars) for readability

## 2. Add TypeScript Type Declaration

- [x] 2.1 Create or update vite-env.d.ts to declare VITE_COMMIT_SHA
- [x] 2.2 Verify TypeScript recognizes the env variable

## 3. Update Settings UI

- [x] 3.1 Read import.meta.env.VITE_COMMIT_SHA in settings component
- [x] 3.2 Add commit hash display section in settings panel
- [x] 3.3 Style the version info (label + hash, muted text)
- [x] 3.4 Handle fallback when env var is undefined (show "dev" or "unknown")

## 4. Test and Verify

- [x] 4.1 Test locally that settings panel shows "dev" or fallback
- [ ] 4.2 Deploy to GitHub Pages and verify hash matches latest commit
- [ ] 4.3 Confirm contact test criteria are met

## 5. Document Co-variance (Delta Specs)

- [x] 5.1 Create `openspec/changes/display-deployed-commit-hash/specs/pwa-settings/spec.md` documenting the new capability
- [x] 5.2 Create `openspec/changes/display-deployed-commit-hash/specs/build-info/spec.md` documenting the build metadata pattern
