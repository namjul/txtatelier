# Design: add-vite-pwa

## Approach

Integrate `vite-plugin-pwa` into the existing Vite-based build system. The plugin will:

1. Generate a web app manifest with TXTAtelier branding
2. Configure Workbox to cache essential assets (JS, CSS, HTML, WASM) for offline access
3. Use a "network-first" strategy for API/data requests (letting Evolu handle sync)
4. Generate PWA assets (icons) using the plugin's asset generation capability
5. Keep dev-mode PWA disabled to avoid development friction
6. Use `registerType: "autoUpdate"` for automatic service worker updates (not prompt)

The configuration will be added to `vite.config.ts`, following the pattern shown in the reference implementations. Since txtatelier uses SolidJS (inferred from the project structure), we'll use a configuration similar to the React example but adapted for our specific needs.

## Rationale

**Why vite-plugin-pwa over alternatives?**
- It's the de facto standard for Vite-based PWAs with 1M+ weekly downloads
- Handles both manifest generation and service worker configuration in one tool
- Workbox integration provides battle-tested caching strategies
- Supports automatic asset generation for icons/splash screens
- Zero-config defaults work well for most use cases

**Why network-first for data, cache-first for assets?**
- txtatelier's local-first architecture means files live on disk, sync through Evolu
- Assets (JS/CSS/HTML) are versioned and safe to cache aggressively
- Data flows through Evolu's sync mechanism, which handles its own offline queue
- We don't want the service worker to interfere with Evolu's sync logic

**Why disable PWA in dev mode?**
- Service workers can complicate development (caching stale code)
- HMR (Hot Module Replacement) conflicts with service worker caching
- Faster development cycles without SW overhead

**Why `registerType: "autoUpdate"`?**
- Service worker checks for and downloads updates automatically
- Users get updates without interaction
- Acceptable trade-off: updates may refresh the page, but txtatelier's local-first architecture preserves all data
- Simpler than building a custom update prompt UI

## Load-bearing assumptions

1. The current `vite.config.ts` uses standard Vite configuration that accepts plugins
2. No existing service worker or manifest that would conflict
3. Build output directory is `dist/` (standard Vite default)
4. Project structure has a main entry HTML file at root
5. `bun` can install and run `vite-plugin-pwa` without issues

## Risks and trade-offs

**Risk: Caching too aggressively**
- If we cache API responses, we might serve stale data
- Mitigation: Only cache static assets, let Evolu handle data

**Risk: Service worker registration failure**
- If the SW fails to register, PWA features won't work
- Mitigation: Add error handling and fallback behavior

**Risk: Increased build time**
- Generating icons and SW can slow builds
- Mitigation: Disable in dev, cache in CI

**Trade-off: Bundle size**
- Workbox adds ~30KB to the service worker
- Acceptable cost for offline capability

## Out of scope

- Push notifications (not needed for txtatelier's use case)
- Background sync (Evolu handles this)
- App shell architecture (overkill for this app)
- iOS-specific splash screen configurations (basic PWA support only)
- Custom offline page (will use cached index.html)

## Known unknowns

1. How will the PWA behave with Evolu's WebSocket connections when offline?
2. Will the service worker interfere with file download/upload if we add that later?
3. What icon sizes are actually needed for all target platforms?
4. How will the PWA handle the WASM SQLite module that Evolu uses?

## Co-variance

**Likely to be affected:**
- `vite.config.ts` - main configuration file
- `package.json` - new dependency addition
- Build output - new `sw.js` and manifest files
- `.gitignore` - may need to ignore generated assets

**May need updates:**
- README.md - document PWA installation
- Development documentation - note that PWA is prod-only

## ⚠ Design warnings

### Responsiveness
The PWA installation prompt and offline indicators don't introduce new UI delays. The service worker installation happens in the background after first load. However, users should understand that "Add to Home Screen" requires the service worker to be fully installed first.

### Continuity after correction
If a user edits offline and those edits fail to sync when back online, the system must preserve the local state. This is primarily Evolu's responsibility, but we need to ensure the PWA doesn't aggressively cache API responses that would mask sync failures.

### Exploratory capacity
The PWA "Install" prompt is a one-time browser UI element. Once dismissed, it may not reappear without clearing site data. We should document this behavior so users know how to install after the initial prompt.
