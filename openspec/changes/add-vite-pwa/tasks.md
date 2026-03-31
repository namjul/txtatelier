## 1. Install dependencies

- [x] 1.1 Install vite-plugin-pwa package: `bun add -D vite-plugin-pwa`
- [x] 1.2 Verify package.json updated with correct dependency

## 2. Configure Vite PWA

- [x] 2.1 Read current vite.config.ts to understand existing configuration
- [x] 2.2 Add VitePWA plugin import to vite.config.ts
- [x] 2.3 Configure VitePWA plugin with manifest, Workbox settings, and `registerType: "autoUpdate"`
- [x] 2.4 Ensure devOptions.enabled is false for development mode

## 3. Generate PWA assets

- [x] 3.1 Create or identify source icon (at least 512x512 PNG or SVG)
- [x] 3.2 Configure pwaAssets in VitePWA plugin options
- [x] 3.3 Run build to generate manifest icons and splash screens
- [x] 3.4 Verify generated assets in dist/ or public/

## 4. Update manifest configuration

- [x] 4.1 Set manifest.name to "TXTAtelier"
- [x] 4.2 Set manifest.short_name to "TXTAtelier"
- [x] 4.3 Set manifest.description to appropriate project description
- [x] 4.4 Set manifest.theme_color and background_color
- [x] 4.5 Configure manifest display mode (standalone recommended)

## 5. Configure Workbox caching

- [x] 5.1 Set globPatterns to cache JS, CSS, HTML, SVG, PNG, WASM files
- [x] 5.2 Enable cleanupOutdatedCaches for cache management
- [x] 5.3 Set clientsClaim: true for immediate SW control
- [x] 5.4 Verify service worker strategy doesn't interfere with Evolu sync

## 6. Test PWA functionality

- [x] 6.1 Build production version: `bun run build`
- [x] 6.2 Serve locally: `bun run preview`
- [x] 6.3 Open in Chrome/Edge and check DevTools > Application for manifest
- [x] 6.4 Verify service worker registers successfully
- [x] 6.5 Run Lighthouse PWA audit and verify score > 90
- [ ] 6.6 Test offline functionality by disabling network

## 7. Document PWA capability

- [x] 7.1 Update README.md with PWA installation instructions
- [x] 7.2 Document that PWA is production-build only (dev mode disabled)
- [x] 7.3 Add troubleshooting section for common PWA issues

## 8. Document co-variance (delta specs)

- [x] 8.1 Create openspec/changes/add-vite-pwa/specs/pwa-configuration/spec.md documenting the Vite PWA configuration
- [x] 8.2 Create openspec/changes/add-vite-pwa/specs/service-worker/spec.md documenting Workbox caching strategy
- [x] 8.3 Create openspec/changes/add-vite-pwa/specs/pwa-assets/spec.md documenting icon and manifest asset requirements
