# Evidence: pwa-share-target-inbox

## Manual verification (tasks 5.x)

Run against a production or `vite preview` build with HTTPS or `localhost` (service worker requires secure context). Install the PWA where applicable.

| Task | Checklist |
|------|-----------|
| 5.1 App closed | Install PWA, fully close it, share plain text from another app, reopen PWA; inbox file gains a new top line with timestamp. |
| 5.2 App open | With PWA in foreground, share text; return to PWA (visibility); line appears without restart. |
| 5.3 URLs | Share a URL; stored line contains the URL string as plain text (no title fetch in Phase 1). |
| 5.4 Files only | Share an image/file with no text; no `pendingShare` line added (silent ignore). |
| 5.5 Offline | Airplane mode, share text; enable network, open app; pending line applies when visible. |
| 5.6 iOS Safari | Documented limitations: Web Share Target support is limited vs Chrome/Android; user may need “Add to Home Screen”; behavior varies by iOS version—verify on device. |
| 5.7 Inbox path change | Settings → set inbox to e.g. `captures/inbox.md`, save, share again; new content hits the new path (create parent path in sync root if needed). |

## Automated coverage

- `centers/pwa/src/share-target/format-shared-line.test.ts` — newline normalization and line format.
- `centers/pwa/src/share-target/inbox-path-validation.test.ts` — path rules for inbox setting.
