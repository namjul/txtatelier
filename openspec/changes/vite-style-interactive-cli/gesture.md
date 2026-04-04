# Gesture: vite-style-interactive-cli

## Gesture type
revision

## What are we gesturing toward?
cli-interaction-loop

## Claim
Users will use keyboard shortcuts (u, s, p, d, c, q) + Enter instead of Ctrl+C for common operations. Shortcuts: status, show mnemonic, paste/restore, delete/reset owner, clear console, quit. Completing actions in under 2 keystrokes versus the current 2+ seconds workflow.

## What made us do this?
Current CLI prints minimal logs and hangs until Ctrl+C. Owner commands (--show, --reset, --where) exist as separate flags requiring process restart. Working across multiple sync directories requires rapid context switching that feels sluggish. Users expect the responsiveness of modern CLIs (Vite, Wrangler) where common actions are instant keyboard shortcuts.

## Load-bearing assumptions
1. Users primarily run CLI in interactive TTY environments (terminals, not CI/pipes)
2. Log-first output (no persistent UI frame) feels responsive enough for rapid iteration
3. Consolidating owner management into interactive mode is more discoverable than separate command flags

## Structures this gesture touches
- cli-interaction-loop (being established)
- owner-management (being absorbed into interactive loop)
- logger-coordination (readline-aware output)

## Co-variance
- CLI entrypoint behavior changes from "hang forever" to "event loop with shortcuts"
- Owner commands may need interactive prompts for destructive operations
- Instance lock messaging may integrate into the interactive banner
- Debug output mode needs coordination with readline prompt
