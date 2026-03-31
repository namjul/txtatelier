# Gesture: add-vite-pwa

## Gesture type
create

## What are we gesturing toward?
progressive-web-app-capability - the ability for users to install txtatelier as an offline-capable application with native app-like experience (icon, standalone mode, offline editing).

## Claim
Users will be able to install txtatelier as a PWA from their browser and edit files offline without losing data when connectivity returns.

## What made us do this?
The txtatelier project is intended to be a local-first file sync system with a web editing interface (Phase 6 of IMPLEMENTATION_PLAN.md). Currently, there's no PWA infrastructure, meaning users cannot:
- Install the app to their home screen
- Work offline and have their changes persist
- Have an app-like experience instead of a browser tab

The Vite PWA plugin provides a production-ready solution for adding service workers, manifest generation, and offline capabilities to Vite-based projects.

## Load-bearing assumptions
1. The current Vite-based build system can integrate `vite-plugin-pwa` without conflicts
2. Service worker caching strategy won't interfere with Evolu's sync mechanism (data flows through Evolu, not direct network)
3. Offline-first approach aligns with txtatelier's "local-first" architecture - files live on disk first, sync second

## Structures this gesture touches
- structures/pwa-configuration/ - Vite PWA plugin configuration and manifest
- structures/service-worker/ - Workbox-based caching and offline strategies
- structures/pwa-assets/ - Icons and visual assets for installation

## Co-variance
- May need to adjust build output configuration in vite.config.ts
- Might reveal gaps in offline error handling in the web interface
- Could surface needs for offline status indicators in the UI
- May require adjustments to the web-to-Evolu sync loop timing when offline
