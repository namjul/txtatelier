# Gesture: pwa-minimal-editor-with-command-menu

## Gesture type
create

## What are we gesturing toward?
minimal-editor-with-ready-to-hand-file-lookup

## Claim
Users will switch files through a command menu without conscious effort (ready-to-hand) rather than navigating visual UI elements (present-at-hand), resulting in sustained focus on writing.

## What made us do this?
Current editor UIs bury the actual text editor under chrome: sidebars, headers, file trees, status bars. Every file switch requires visually parsing UI hierarchy. This creates friction that pulls attention away from the content being written. The editor—the primary activity—should dominate the viewport. Everything else is a distraction that must justify its presence.

## Load-bearing assumptions
1. **Keyboard-triggered command menu on desktop**: Users can access file switching via Cmd/Ctrl+K without reaching for mouse
2. **Thumb-accessible trigger on mobile**: A gesture or bottom-bar tap opens command menu without two-hand typing interruption
3. **Editor viewport >85% of screen**: Visual chrome (headers, sidebars) occupies less than 15% combined

## Structures this gesture touches
- structures/command-menu/
- structures/minimal-editor-chrome/
- structures/file-navigation/

## Co-variance
- Mobile keyboard handling may need adjustment for command menu overlay
- File metadata display may shift from sidebar to command menu preview
- Editor focus management may need coordination with dialog system
