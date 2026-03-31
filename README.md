# txtatelier

Local-first, multi-device file sync with Evolu. See [PROJECT.md](./PROJECT.md) for architecture and [AGENTS.md](./AGENTS.md) for contributor tooling.

## Web app (PWA)

The installable web client lives in `centers/pwa` (Vite + SolidJS).

### Install and run (production-style)

From the repository root:

```bash
cd centers/pwa
bun install
bun run build
bun run preview
```

Open the URL printed by `preview` (for example `http://127.0.0.1:4173/`). In Chromium-based browsers, use the install affordance in the address bar or the Application tab in DevTools to confirm the manifest and service worker.

**Note:** The service worker and full PWA tooling run only on **production builds**. `bun run dev` keeps PWA generation disabled so HMR and caching do not fight each other.

### PWA troubleshooting

- **Stale UI after deploy:** Hard-refresh once or close all app tabs so the new service worker from `registerType: "autoUpdate"` can activate.
- **No install prompt:** Installation needs a valid manifest, registered service worker, and (for most browsers) **HTTPS** or `localhost`. Test installs on HTTPS staging or production, not only on raw LAN HTTP.
- **Build fails with `assignWith is not defined`:** The workspace pins `lodash@4.17.21` via root `package.json` `overrides` because `lodash@4.18.0` breaks `workbox-build`’s SW template. Run `bun install --force` after pulling if nested `lodash` copies look wrong.
- **Install prompt dismissed:** Use the browser menu (“Install app” / “Create shortcut”) or clear site data for the origin to surface install UI again.
- **Lighthouse “PWA” category missing:** Lighthouse 12.x reports may omit a dedicated PWA category; use Chromium DevTools → Application → Manifest and Service workers, or run `npx lighthouse@11.7.1 <url> --only-categories=pwa` for a numeric PWA score (for example after `bun run preview` on `http://127.0.0.1:4173/`). For installability scoring in CI, prefer **HTTPS** URLs when possible.
