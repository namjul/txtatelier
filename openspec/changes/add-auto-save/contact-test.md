# Contact Test: add-auto-save

## Evidence tier
proximal

## What would success look like?
- Editor shows auto-save indicator (e.g., "Saving..." → "Saved") with visual feedback
- Content persists within 300ms of stopping typing without pressing Ctrl+S or clicking a button
- No lost work when closing browser tab or navigating away during editing
- Sync loop does not trigger excessive re-renders or CPU spikes

## What would falsify this claim?
- Auto-save triggers sync loops causing re-renders or performance issues
- Users report lost work because they expected save to happen but it didn't
- Auto-save creates file conflicts with CLI sync operations
- Editor becomes unresponsive during typing due to save operations

## How will we check?
Use it yourself for editing sessions across multiple files for 3-5 days:
- Monitor with browser devtools Performance tab during typing
- Check for sync loop indicators (repeated re-renders of file tree)
- Verify content appears in database/Evolu immediately after debounce period
- Test closing browser tab during editing and reopening to confirm persistence

## When will we check?
After 5 days of self-usage with the auto-save feature implemented.
