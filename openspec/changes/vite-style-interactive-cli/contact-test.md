# Contact Test: vite-style-interactive-cli

## Evidence tier
proximal

## What would success look like?
During active development, we use keyboard shortcuts (r, u, s, p, d, c, q + Enter) for common operations instead of Ctrl+C. Restarting sync takes <1 second via 'r' + Enter versus the current 2+ seconds (Ctrl+C, up-arrow, Enter). We reach for shortcuts instinctively and forget they are new.

Shortcuts: r=restart, u=status, s=show mnemonic, p=paste/restore mnemonic, d=delete/reset owner, c=clear, q=quit.

## What would falsify this claim?
We continue using Ctrl+C and command history because:
- Shortcuts feel slower due to readline delay (must press Enter)
- We forget shortcuts exist and reach for Ctrl+C instinctively
- We avoid the interactive mode and prefer --no-interactive for "clean" logs

## How will we check?
Use the interactive CLI for 5 consecutive days of active txtatelier development. Keep a simple tally: mark each time we use a shortcut versus Ctrl+C. After 5 days, shortcuts should account for >80% of stop/restart/clear operations.

## When will we check?
5 consecutive days of active development starting the day after implementation completes. Target: within 2 weeks of gesture acceptance.
