# Explore: remove-bun-dependency

## What we are noticing

The CLI package has hard-coded Bun-specific entry points in at least two places:
`BunSqliteDriver.ts` and `BunEvoluDeps.ts`. These are the composition root for
the Evolu database layer. Running the CLI with Node.js or Deno fails because
these modules import Bun APIs directly (`bun:sqlite`).

There is also a direct `node:crypto` import in `index.ts` which, while
technically Node-compatible, is not Deno-compatible without a polyfill.

The global `logger` is imported in 9 files via relative path. This isn't
Bun-specific, but it is tightly coupled in a way that would need addressing
as part of any runtime-portability work.

## What we don't understand

- What Evolu itself expects from the runtime — does `EvoluDatabase` assume Bun,
  or is the Bun coupling purely in our adapter layer?
- Whether Deno's `npm:` specifiers can satisfy the existing imports without
  code changes, or if new adapter files are required.
- Whether the `PlatformIO` abstraction already in the codebase was intended to be the seam for runtime portability, or if it has grown Bun-specific.
- How the watcher (`watch.ts`) handles file events — does it use Bun's native watcher or the cross-runtime `chokidar`/`node:fs` watcher?

## What we want to poke at

- Read `BunSqliteDriver.ts` and `BunEvoluDeps.ts` to understand exactly which
  Bun APIs are in use and whether Evolu ships a Node/Deno equivalent driver.
- Check Evolu's package exports for a `NodeSqliteDriver` or similar.
- Trace how `BunEvoluDeps.ts` is wired into the composition root to understand
  the injection surface.
- Look at the existing `PlatformIO` interface to see how much is already
  abstracted.

## What would make this worth a full intervention

We already know this is worth doing — the trigger condition from the earlier
exploration ("Preparing for non-Bun environments") has been explicitly
requested. The exit condition for this exploration is:

- Confirmed: Evolu ships a runtime-agnostic driver or a Node/Deno adapter
  that can replace `BunSqliteDriver.ts`
- Confirmed: the Bun surface is limited to the two adapter files (plus
  `node:crypto`), not spread throughout business logic
- Understood: what the composition root needs to look like for each target
  runtime
