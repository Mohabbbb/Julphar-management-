#!/usr/bin/env bash
# Run every test seam of docs/spec-stock-from-orders.md. Exit code is non-zero if anything fails.
#   1. build   python3 build.py dist/Julphar_Platform.html
#   2. engine  node --test (seams 1 and 2: Eng.acctStock, Eng.predictions)
#   3. page    python3 t/page_test.py (seam 3: built page in headless Chromium)
cd "$(dirname "$0")/.." || exit 2

status=0
summary=()
step() {  # step <label> <command...>
  local label=$1; shift
  echo "=== $label: $*"
  if "$@"; then summary+=("PASS  $label"); else summary+=("FAIL  $label"); status=1; fi
  echo
}

step "build " python3 build.py dist/Julphar_Platform.html
step "engine" node --test t/*.test.js
step "page  " python3 t/page_test.py

echo "=== summary"
printf '%s\n' "${summary[@]}"
[ $status -eq 0 ] && echo "ALL PASSED" || echo "SOME FAILED"
exit $status
