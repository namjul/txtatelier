## ADDED Requirements

### Requirement: Vite PWA plugin wiring

The PWA workspace SHALL integrate `vite-plugin-pwa` in `centers/pwa/vite.config.ts` with `registerType: "autoUpdate"`, a web app manifest suitable for installation, `devOptions.enabled` set to false, and `pwaAssets` generation from a single source image using the `minimal-2023` preset.

#### Scenario: Production build emits install metadata

- **WHEN** `bun run build` is run in `centers/pwa`
- **THEN** the build output includes `manifest.webmanifest`, a generated service worker script, and precache metadata without enabling PWA behavior during `bun run dev`

#### Scenario: Client registers the service worker

- **WHEN** the production bundle loads in a supporting browser
- **THEN** the application imports `virtual:pwa-register` and calls `registerSW({ immediate: true })` so updates apply automatically without a custom prompt UI
