## 1. Update Conflict File Content Generation

- [ ] 1.1 Locate conflict file creation code in `conflicts.ts`
- [ ] 1.2 Create function to generate markdown guidance header
- [ ] 1.3 Add "# Conflict: Remote Deletion" title to header
- [ ] 1.4 Add "Common causes" section listing rename, deletion, and external tool scenarios
- [ ] 1.5 Add "To resolve" section with 4-step resolution instructions
- [ ] 1.6 Add "Your preserved changes:" text and "---" separator
- [ ] 1.7 Modify conflict file creation to prepend guidance header to original content
- [ ] 1.8 Verify original content remains byte-identical after header addition

## 2. Add Rename Suspicion Logging (Optional)

- [ ] 2.1 Add data structure to track recent deletions (path, contentHash, timestamp)
- [ ] 2.2 Update deletion handling to record deletions in tracking structure
- [ ] 2.3 Add garbage collection for deletion records older than 5 seconds
- [ ] 2.4 On file creation, check if hash matches recent deletion within time window
- [ ] 2.5 Log "Possible rename detected: oldPath → newPath" when match found
- [ ] 2.6 Ensure logging is info level (not error or warn)

## 3. Update Documentation

- [ ] 3.1 Read existing AGENTS.md error handling section
- [ ] 3.2 Add new subsection explaining rename = delete + create behavior
- [ ] 3.3 Document that this matches Obsidian, Logseq, Dendron approaches
- [ ] 3.4 Explain when "remote-delete" conflicts occur during renames
- [ ] 3.5 Document best practices (rename while CLI running for immediate sync)
- [ ] 3.6 Add troubleshooting section for false deletion conflicts

## 4. Testing

- [ ] 4.1 Write unit test for guidance header generation function
- [ ] 4.2 Write integration test: rename on Device A, edit on Device B, verify conflict content
- [ ] 4.3 Test that conflict file contains all required header sections
- [ ] 4.4 Test that original content is preserved byte-for-byte after header
- [ ] 4.5 Test filename format remains `*.conflict-remote-delete-<timestamp>.md`
- [ ] 4.6 Manual test: Create rename scenario and inspect generated conflict file
- [ ] 4.7 If logging implemented: Test that suspected renames are logged correctly

## 5. Validation

- [ ] 5.1 Run all existing integration tests - verify no regressions
- [ ] 5.2 Run unit tests - verify all pass
- [ ] 5.3 Run typecheck - verify no TypeScript errors
- [ ] 5.4 Run linter - verify no new warnings
- [ ] 5.5 Verify conflict file readability in markdown editor (headers render correctly)
