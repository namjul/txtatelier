# Gesture: pwa-share-target-inbox

## Gesture type
create

## What are we gesturing toward?
pwa-share-target - Web Share Target API integration that allows users to share content directly into txtatelier

## Claim
Users will use the share_target feature at least once per week to capture content into inbox.md, preferring it over manual file creation or copy-paste workflows.

## What made us do this?
Mobile-first note-taking requires frictionless capture. Users currently need to: open the app, navigate to the right file, paste content. The Web Share Target API allows any app (browser, photos, notes) to share directly to txtatelier. Without this, txtatelier remains a desktop-centric tool, missing the primary mobile capture workflow that makes local-first apps viable.

## Load-bearing assumptions
1. Web Share Target API is supported on the user's device/browser (Chrome/Android have full support, iOS Safari 16.4+ has partial support)
2. Users want a single configurable "inbox" file rather than per-share-type routing (separate files for links vs text vs images)
3. Automatic capture is acceptable friction trade-off - users prefer speed over confirmation for quick notes

## Structures this gesture touches
- structures/pwa-manifest/ (modification to web app manifest)
- structures/share-target-handler/ (new: service worker and UI for handling shared content)
- structures/settings-inbox-path/ (new: configurable path for inbox file)

## Co-variance
- May affect structures/pwa-routing/ if share target opens specific view
- May reveal need for structures/share-history/ if users want to track what was shared
- File sync structures may need awareness of "captured via share" metadata
