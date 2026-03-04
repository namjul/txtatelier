#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../../../.." && pwd)"
CAPTURE_FILE="${ROOT_DIR}/centers/cli/src/file-sync/sync/change-capture.ts"
MATERIALIZE_FILE="${ROOT_DIR}/centers/cli/src/file-sync/sync/state-materialization.ts"

assert_no_match() {
  local pattern="$1"
  local file="$2"
  local message="$3"

  if rg -n --fixed-strings "${pattern}" "${file}" >/dev/null; then
    echo "FAIL: ${message}"
    echo "Matched pattern '${pattern}' in ${file}"
    exit 1
  fi
}

assert_match() {
  local pattern="$1"
  local file="$2"
  local message="$3"

  if ! rg -n --fixed-strings "${pattern}" "${file}" >/dev/null; then
    echo "FAIL: ${message}"
    echo "Missing pattern '${pattern}' in ${file}"
    exit 1
  fi
}

echo "Checking directional invariants..."

assert_match "export const captureChange" "${CAPTURE_FILE}" "capture module must export captureChange"
assert_no_match "createConflictFile(" "${CAPTURE_FILE}" "capture module must not create conflict artifacts"
assert_no_match "writeFileAtomic(" "${CAPTURE_FILE}" "capture module must not write canonical files"

assert_match "export const startStateMaterialization" "${MATERIALIZE_FILE}" "materialization module must export startStateMaterialization"
assert_no_match "from \"./change-capture\"" "${MATERIALIZE_FILE}" "materialization module must not import capture module directly"
assert_no_match "evolu.insert(\"file\"" "${MATERIALIZE_FILE}" "materialization must not insert mirror file rows"
assert_no_match "evolu.update(\"file\"" "${MATERIALIZE_FILE}" "materialization must not update mirror file rows"

echo "PASS: directional invariants hold"
