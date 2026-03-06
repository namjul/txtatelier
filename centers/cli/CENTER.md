# CLI Center

**Status:** Proposed
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

---

## What This Center Does

Command-line interface for txtatelier. Provides user commands for sync operations, conflict management, and system observability.

Currently: Blank canvas - no functionality implemented.

**Internal structure:**
- `src/file-sync/` - Loop A (Filesystem → Evolu) implementation (see file-sync/CENTER.md)
- `src/index.ts` - CLI entry point and command orchestration

---

## Center Definition

### Hypothesis

The CLI center will organize user interaction with the file sync system, providing commands for status, conflict resolution, and manual sync triggers.

**This center:**
- Provides command-line interface for users (when implemented)
- Contains file-sync center (Loop A: Filesystem → Evolu)
- Will contain evolu-sync center (Loop B: Evolu → Filesystem, Phase 1)
- Offers observability commands (Phase 8)

**Contact test for "will this become a center?"**
- Success-if: Users rely on CLI commands daily, removing it blocks workflow
- Failure-if: CLI is just thin wrapper, could be replaced with shell scripts

### Current Strength

Proposed - blank canvas only, no functionality

**Evidence:**
- None yet - awaiting Phase 0 implementation

---

## Planned Interventions

### 2026-03-01 - Create Blank Canvas

**Aim:** Establish CLI workspace structure before Phase 0 implementation

**Claim:** Creating workspace structure now enables Phase 0 work to begin immediately

**Status:** In Progress

---

### Future - First-Run Mnemonic Confirmation

**Aim:** Prevent "lost mnemonic" support issues by forcing users to acknowledge they've saved their mnemonic

**Claim:** Blocking startup until user confirms mnemonic (by typing random word from phrase) will prevent data loss from lost mnemonics

**Assumptions:**
- Users lose mnemonics because first-run display is easy to ignore
- Interactive confirmation creates sufficient friction to force acknowledgment
- Non-interactive environments (services, CI) can skip confirmation safely

**Proposed Implementation:**
```typescript
// In file-sync/index.ts, during first run:
if (isFirstRun && !restoreMnemonic) {
  // Display mnemonic with prominent warnings
  logger.log("[file-sync] Your mnemonic:");
  logger.log(`[file-sync]   ${owner.mnemonic}`);
  
  // Block until user confirms (interactive mode only)
  if (process.stdin.isTTY) {
    await confirmMnemonicSaved(owner.mnemonic);
  } else {
    logger.log("[file-sync] Running in non-interactive mode.");
    logger.log("[file-sync] SAVE THE MNEMONIC ABOVE IMMEDIATELY!");
  }
}

// New function in mnemonic-confirmation.ts:
const confirmMnemonicSaved = async (mnemonic: string): Promise<void> => {
  // Pick 2 random words from mnemonic (positions 2-9)
  // Prompt: "To confirm, type word #5: _"
  // Allow 3 attempts per word
  // On failure: re-display mnemonic, reset attempts
};
```

**Changes Required:**
- New file: `src/file-sync/mnemonic-confirmation.ts` (utility, not center)
- Modify: `src/file-sync/index.ts` (add confirmation call on first run)
- Handle: Non-interactive mode (check `process.stdin.isTTY`, skip confirmation)

**Contact Test:**
- Success-if: Users cannot proceed past first run without confirming mnemonic, "lost mnemonic" issues decrease to near-zero
- Failure-if: Users find workarounds to skip confirmation, or non-interactive environments break
- Measurement: User feedback, support requests about lost mnemonics
- Timeline: After first 10 users complete first-run setup

**Status:** Planned

**Notes:**
- Does NOT require new centers (just utility function)
- Integrates with existing `owner show|restore` commands
- Will integrate cleanly with future Background Service `init` command
- Skipped features: QR codes (not needed), encrypted export (low value), OS keychain (over-engineering)

---

### Future - Background Service (OS-Managed Daemon)

**Aim:** Transform CLI from manual execution to OS-managed background service that starts automatically and survives restart

**Claim:** OS-native service management will eliminate "forgot to start sync" failures and increase user confidence through always-on availability

**Assumptions:**
- Users want "set it and forget it" behavior (like Dropbox, not manual rsync)
- OS service managers (launchd/systemd/Task Scheduler) are reliable enough
- Single-instance locking can prevent double-start issues
- Config file approach is simpler than environment variables for persistent state

**Proposed Architecture:**

**New Center Created:**
- **Service-Manager Center** (module at `src/service-manager/`)
  - Organizes 3 platform implementations (macOS/Linux/Windows)
  - Contact test: Removing it scatters service logic across CLI commands
  - Structure:
    ```
    service-manager/
    ├── CENTER.md
    ├── index.ts              # ServiceManager interface
    ├── macos-launchd.ts      # LaunchAgent implementation
    ├── linux-systemd.ts      # systemd user service
    ├── windows-task.ts       # Task Scheduler
    └── process-lock.ts       # Single-instance via flock
    ```

**CLI Commands Added:**
```bash
txtatelier init --root <path>   # One-time setup: validate, config, install service, start
txtatelier start                # Manual start (checks for running instance)
txtatelier start --foreground   # For OS service manager (never daemonizes)
txtatelier stop                 # Stop service
txtatelier restart              # Restart service
txtatelier status               # Check service state
txtatelier service install      # Install OS service definition
txtatelier service uninstall    # Remove OS service
txtatelier doctor               # Diagnose configuration issues
```

**Config File Approach:**
- Location: `~/.config/txtatelier/config.json`
- Contents:
  ```json
  {
    "version": 1,
    "rootPath": "/home/user/notes",
    "ownerId": "o5EuFYnq...",
    "relayUrl": "ws://localhost:4000"
  }
  ```
- Replaces environment variables (TXTATELIER_WATCH_DIR, etc.)
- Simple read/write utility functions (not a "Config Center")

**Implementation Details:**

**macOS (LaunchAgent):**
```xml
<!-- ~/Library/LaunchAgents/com.txtatelier.sync.plist -->
<plist>
  <key>Label</key>
  <string>com.txtatelier.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/absolute/path/to/txtatelier</string>
    <string>start</string>
    <string>--foreground</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</plist>
```

**Linux (systemd user service):**
```ini
# ~/.config/systemd/user/txtatelier.service
[Unit]
Description=Txtatelier Sync Service

[Service]
ExecStart=/absolute/path/to/txtatelier start --foreground
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

**Windows (Task Scheduler):**
```bash
schtasks /Create /SC ONLOGON /TN txtatelier \
  /TR "C:\Path\to\txtatelier.exe start --foreground" \
  /RL LIMITED
```

**Key Principles:**
- Process NEVER forks or daemonizes itself
- OS service manager controls lifecycle
- All logs go to stdout/stderr (OS captures them)
- Single-instance lock prevents double-start (flock on `~/.config/txtatelier/lock`)
- Service is per-user only (no admin/root required)

**Center Impact:**
- **CLI Center strengthened:** Becomes lifecycle orchestrator, not just sync trigger
- **File-Sync Center strengthened:** Gains automatic lifecycle, single-instance guarantee
- **Service-Manager Center created:** Organizes OS integration

**Contact Test:**
- Success-if: Service survives restart without intervention, users say "I never think about starting it", `doctor` catches misconfigurations
- Failure-if: Service crashes without restart, users confused about state, multiple instances run, platform differences create support burden
- Measurement: Uptime stats, user feedback, support tickets about "sync not running"
- Timeline: After 1 week of continuous operation on each platform

**Status:** Planned

**Open Questions:**
- Init idempotency: Can user run `init` multiple times safely? (Proposal: yes, idempotent)
- Multi-root support: One service per user, or multiple services for different roots? (Proposal: single root per user initially)
- Linux linger: Auto-enable `loginctl enable-linger`, or warn user? (Proposal: detect and warn with instructions)
- Config format: JSON or TOML? (Proposal: JSON for simplicity)
- Restart behavior: Should restart work if not running (start it)? (Proposal: yes, idempotent)

**Notes:**
- No "Identity Center" or "Keychain Center" - those were over-abstractions
- No "Config Center" - just simple utility functions for JSON read/write
- Service-Manager is only new center (real organizing power around platform differences)
- Mnemonic confirmation integrates cleanly with `init` command flow

---

## Relationships to Other Centers

**Contains internally:**
- file-sync center (Phase 0) - Loop A implementation
- evolu-sync center (Phase 1) - Loop B implementation
- conflict-handler logic (Phase 3) - conflict detection and resolution

**Will be strengthened by:**
- workspace-center-field - validates CLI as legitimate center

---

## Open Questions

- Which CLI framework to use? (commander, yargs, or custom)
- How granular should commands be?
- Should CLI have interactive mode or just commands?
