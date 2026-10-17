#!/usr/bin/env bash
# Run every test seam of docs/spec-stock-from-orders.md. Exit code is non-zero if anything fails.
#   1. build   python3 build.py dist/Julphar_Platform.html
#   2. engine  node --test (seams 1 and 2: Eng.acctStock, Eng.predictions)
#   3. page    python3 t/page_test.py (seam 3: built page in headless Chromium)
#   4. fixes   python3 t/fixes_test.py (regression tests for the 2026-10-11 fixes F1-F6)
cd "$(dirname "$0")/.." || exit 2

# Local macOS setup: the repo venv supplies playwright, and the browsers live in
# the per-user cache. page_test.py and fixes_test.py default to /opt/pw-browsers
# (a CI path), so the browser path must be set before they run. Both honour a
# value already in the environment, so CI can still point them elsewhere.
[ -d .venv/bin ] && export PATH="$PWD/.venv/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"

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
step "fixes " python3 t/fixes_test.py

echo "=== summary"
printf '%s\n' "${summary[@]}"
[ $status -eq 0 ] && echo "ALL PASSED" || echo "SOME FAILED"
exit $status
