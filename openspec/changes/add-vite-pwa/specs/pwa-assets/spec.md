## ADDED Requirements

### Requirement: Single-source PWA icons

The PWA workspace SHALL keep a vector source image at `centers/pwa/public/pwa-source.svg` (512×512 viewBox) and SHALL configure `pwaAssets` so production builds generate PNG icons, maskable artwork, favicon, and Apple touch icon, with manifest `icons` populated to match generated files.

#### Scenario: Build produces icon set

- **WHEN** `bun run build` completes in `centers/pwa`
- **THEN** the output directory contains multiple PNG icon sizes, `maskable-icon-512x512.png`, `favicon.ico`, `apple-touch-icon-180x180.png`, and the manifest references those icon entries

#### Scenario: Brand colors align with manifest

- **WHEN** the web app manifest is generated
- **THEN** `theme_color` and `background_color` match the intended TXTAtelier shell color (`#0f172a`) and the HTML entry receives an injected `theme-color` meta tag consistent with that value
