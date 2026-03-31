# Gesture: command-menu-settings-action

## Gesture type
strengthen

## What are we gesturing toward?
command-menu-mobile-accessibility

## Claim
Mobile users will successfully open Settings by typing "?" in the CommandMenu, without needing a dedicated settings button or gesture.

## What made us do this?
SettingsDialog is currently inaccessible on mobile devices. Desktop users can open it with Meta/Ctrl + comma, but mobile users have no touch-based way to access settings. The CommandMenu already has a mobile affordance (bottom bar tap/swipe up), making it the natural gateway for rarely-used actions.

## Load-bearing assumptions
1. Mobile users can discover the "?" trigger (or don't need to—it's for edge cases)
2. Two taps (open CommandMenu → type "?" → tap Settings) is acceptable for rarely-accessed settings
3. Adding one hardcoded action won't clutter the file-switching UI when not triggered

## Structures this gesture touches
- structures/command-menu/

## Co-variance
- May establish pattern for adding other actions to CommandMenu (help, keyboard shortcuts)
- May reveal need for action grouping/visual distinction in CommandMenu UI
