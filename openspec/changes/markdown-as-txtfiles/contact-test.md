# Contact Test: markdown-as-txtfiles

## Evidence tier
proximal

## What would success look like?
Placing a `.md` file in the watch directory and seeing it appear in the file list and sync to Evolu. The file should behave identically to a `.txt` file — no special handling, no errors.

## What would falsify this claim?
1. A `.md` file is silently ignored (does not appear in file list)
2. A `.md` file causes an error in the sync pipeline
3. Conflict detection or rename detection behaves differently for `.md` vs `.txt` files

## How will we check?
**Hard check:**
1. Create a test `.md` file with simple content
2. Run the file scanner — verify the file is picked up
3. Verify it appears in the sync queue and is processed without errors
4. Query the database — verify the file record exists with correct content hash

**Soft check:**
Use the system myself for a week with mixed `.txt` and `.md` files, observing that both types behave identically.

## When will we check?
Immediately after implementation, during the verification phase of the tasks.

**Timeline:** During the next coding session after the change is applied.

**Success condition:** Both hard and soft checks pass — `.md` files are treated as first-class text files with zero friction.
