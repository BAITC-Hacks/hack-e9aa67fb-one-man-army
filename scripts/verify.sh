#!/bin/bash
# pnpm verify - the final validation sequence for the competition repository.
#
# Layered so the common case is fast: lint/typecheck/unit first, then the
# slower integration and build steps. Stops nothing on first failure - it
# reports every problem at once, because at T+04:30 you want the full list.
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)" || exit 1

failures=0
run() {
  local label="$1"; shift
  echo ""
  echo "── $label"
  if "$@" 2>&1 | tail -20; then
    echo "   ok"
  else
    echo "   FAIL: $label"
    failures=$((failures + 1))
  fi
}
has() { node -e "process.exit(require('./package.json').scripts?.['$1']?0:1)" 2>/dev/null; }

echo "Verification sequence"

has lint      && run "lint"       pnpm lint
has typecheck && run "typecheck"  pnpm typecheck
has test      && run "unit tests" pnpm test
has build     && run "build"      pnpm build

# E2E and evals are opt-in: they are slow and need a running app.
# Each is skipped - not failed - when its preconditions are absent, so a
# scaffold with no specs yet does not report a false failure.
if [[ "${FULL:-0}" == "1" ]]; then
  echo ""
  echo "── e2e"
  if ! has test:e2e; then
    echo "   skip: no test:e2e script"
  elif [[ ! -d e2e ]] || ! compgen -G "e2e/*.spec.ts" >/dev/null; then
    echo "   skip: no specs in e2e/ yet"
  else
    if pnpm test:e2e 2>&1 | tail -15; then echo "   ok"; else echo "   FAIL: e2e"; failures=$((failures + 1)); fi
  fi

  echo ""
  echo "── eval"
  if ! has eval; then
    echo "   skip: no eval script"
  elif [[ ! -f promptfoo.yaml ]]; then
    echo "   skip: no promptfoo.yaml"
  elif ! pnpm exec promptfoo --version >/dev/null 2>&1; then
    echo "   skip: promptfoo not installed (pnpm add -D promptfoo)"
  elif ! curl -fsS "http://localhost:${PORT:-3000}/api/health" >/dev/null 2>&1; then
    echo "   skip: app not running on :${PORT:-3000} - start it, then re-run"
  else
    if pnpm eval 2>&1 | tail -12; then echo "   ok"; else echo "   FAIL: eval"; failures=$((failures + 1)); fi
  fi
else
  echo ""
  echo "── skipped (set FULL=1 to include): e2e, eval"
fi

echo ""
echo "── secrets scan"
# `git grep` exits 0 with no output outside a repository, so the check would
# pass vacuously while a real credential sat in the tree. Detect that and fall
# back to a plain recursive grep rather than reporting a meaningless pass.
SECRET_RE='(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16})'
if git rev-parse --git-dir >/dev/null 2>&1; then
  if git grep -nIE "$SECRET_RE" -- ':!*.test.*' ':!tests/*' ':!docs/*' ':!*.md' 2>/dev/null; then
    echo "   FAIL: possible credential committed (above)"
    failures=$((failures + 1))
  else
    echo "   ok: no credentials found in tracked source"
  fi
else
  echo "   note: not a git repository - scanning the working tree instead"
  if grep -rInE "$SECRET_RE" . \
       --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=docs \
       --exclude="*.test.*" --exclude="*.md" 2>/dev/null; then
    echo "   FAIL: possible credential in the working tree (above)"
    failures=$((failures + 1))
  else
    echo "   ok: no credentials found in the working tree"
  fi
fi

echo ""
echo "── environment variables documented"
if [[ -f .env.example ]]; then
  undocumented=$(git grep -hoE 'process\.env\.[A-Z0-9_]+' -- 'lib' 'app' 'src' 2>/dev/null \
    | sed 's/process\.env\.//' | sort -u \
    | while read -r v; do
        [[ -z "$v" ]] && continue
        grep -qE "^#?[[:space:]]*$v=" .env.example || echo "$v"
      done)
  if [[ -n "$undocumented" ]]; then
    echo "   FAIL: read by the code but missing from .env.example:"
    echo "$undocumented" | sed 's/^/     - /'
    failures=$((failures + 1))
  else
    echo "   ok: every variable the code reads is documented"
  fi
else
  echo "   FAIL: .env.example missing"
  failures=$((failures + 1))
fi

echo ""
if [[ $failures -eq 0 ]]; then
  echo "VERIFY: PASS"
  echo "Next: bash scripts/clean-room-test.sh"
  exit 0
fi
echo "VERIFY: $failures failure(s)"
exit 1
