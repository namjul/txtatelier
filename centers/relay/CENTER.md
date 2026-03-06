# Relay Center

**Status:** Emerging
**Created:** 2026-03-06
**Last Updated:** 2026-03-06

---

## Current Description

The Relay center provides a self-hosted Evolu WebSocket relay server for multi-device synchronization. It enables devices to sync file changes through a local relay instead of relying on external infrastructure.

### Operational Definition

**This center:**
- Runs an Evolu-compatible WebSocket relay server on a configurable port
- Manages per-owner quota limits for sync data
- Stores relay database in isolated data directory (`data/relay/`)
- Provides clean startup/shutdown with signal handling
- Exposes configuration through environment variables
- Runs via Node.js/tsx (not Bun) due to `better-sqlite3` dependency

**Contact test for "is this a center?"**
- Success-if: Multiple devices can sync through this relay, and removing it breaks multi-device sync for self-hosted setups
- Failure-if: Relay is just a thin wrapper around Evolu's relay with no organizing behavior

### Current Strength

Weak

**Evidence:**
- Basic relay server implementation complete
- Workspace structure established with package.json and CENTER.md
- No usage data yet - needs actual multi-device testing
- No observability or monitoring beyond basic console logging

---

## History

### 2026-03-06 - Create relay center

**What changed:** Created relay workspace with Evolu relay server implementation

**Why:** Enable self-hosted multi-device sync without dependency on external relay infrastructure

**Expected:** Devices can connect to local relay for testing and development

**Actual:** Relay server runs successfully via tsx (Node.js runtime required for `better-sqlite3`), not yet tested with actual devices

**Learned:** 
- Relay requires Node.js runtime due to `better-sqlite3` dependency (Bun not supported)
- Relay is minimal wrapper around Evolu's relay - strength will come from integration with CLI and observability
- Database stored in `data/relay/evolu-relay.db` (40KB on first run)

---

## Planned Interventions

### 2026-03-06 - Establish relay as workspace center

**Aim:** Organize relay functionality as explicit center with proper documentation

**Claim:** Creating relay as workspace center enables future expansion (monitoring, device management, quota controls)

**Assumptions:**
- Relay will need more than just basic relay functionality (observability, management)
- Self-hosted relay is valuable for development and privacy-focused deployments
- Relay functionality deserves workspace-level organization

**Contact Test:**
- Success-if: Two CLI devices successfully sync through local relay within 10 seconds
- Failure-if: Relay connection fails or sync doesn't propagate
- Measurement: Manual testing with two CLI instances
- Timeline: Immediate after integration with CLI

**Status:** In Progress

---

### Future - Add relay observability

**Aim:** Make relay activity visible for debugging and monitoring

**Claim:** Exposing active connections, sync events, and quota usage will strengthen relay as debugging tool

**Assumptions:**
- Developers need visibility into relay behavior during multi-device testing
- Evolu relay provides hooks for monitoring
- Console logging is insufficient for understanding sync behavior

**Contact Test:**
- Success-if: Can identify which devices are connected and when sync events occur
- Failure-if: Still flying blind during multi-device debugging
- Measurement: Debugging session with multiple devices
- Timeline: After first multi-device test session reveals pain points

**Status:** Planned

---

## Relationships to Other Centers

**Strengthens:**
- file-sync (CLI) - Enables multi-device testing without external dependencies

**Strengthened by:**
- workspace-center-field - Validates relay as legitimate center

**Competes with:**
- External Evolu relay (`wss://free.evoluhq.com`) - Provides same functionality for public use

---

## Open Questions

- Should relay support authentication/access control beyond quota limits?
- Should relay data be persistent or ephemeral for testing?
- How should relay expose observability data (logs, metrics, events)?
- Should relay be containerized for deployment?
- Should CLI auto-detect local relay vs external relay?
