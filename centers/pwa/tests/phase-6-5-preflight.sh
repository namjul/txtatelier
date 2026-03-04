#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

printf "\n[phase-6.5] Running repo typecheck...\n"
bun run typecheck

printf "\n[phase-6.5] Building PWA...\n"
(cd "$ROOT_DIR/centers/pwa" && bun run build)

printf "\n[phase-6.5] Running CLI regression checks...\n"
bash "$ROOT_DIR/centers/cli/src/file-sync/tests/test-directional-invariants.sh"
bash "$ROOT_DIR/centers/cli/src/file-sync/tests/test-conflict-artifact-callback.sh"

printf "\n[phase-6.5] Preflight complete.\n"
printf "Manual browser flows remain in centers/pwa/PHASE_6_5_VERIFICATION.md\n"
