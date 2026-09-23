#!/bin/bash
# Clean-room verification: approximate what a judge does on a fresh machine.
#
# Copies the tracked repository to a temporary directory, installs from the
# lockfile, configures the documented environment, seeds, builds, starts and
# health-checks it. A failure here is a release blocker, not a warning:
# reproducibility is 20 of 100 points.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PORT="${CLEAN_ROOM_PORT:-3199}"
SERVER_PID=""
failures=0

cleanup() {
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$WORK"
}
trap cleanup EXIT

step()  { echo ""; echo "── $1"; }
ok()    { echo "   ok: $1"; }
bad()   { echo "   FAIL: $1"; failures=$((failures + 1)); }

echo "Clean-room verification"
echo "Source: $REPO_ROOT"
echo "Work:   $WORK"

step "1/8 Copy tracked files only (as a judge's clone would)"
if git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  # Honours .gitignore, so node_modules/.env/.next never leak into the test.
  git -C "$REPO_ROOT" archive --format=tar HEAD 2>/dev/null | tar -x -C "$WORK" && ok "exported from HEAD"
  if [[ -z "$(ls -A "$WORK")" ]]; then
    bad "git archive produced nothing - commit your work before clean-room testing"
    echo ""; echo "RESULT: BLOCKED ($failures failure(s))"; exit 1
  fi
else
  bad "not a git repository"
  exit 1
fi

cd "$WORK" || exit 1

step "2/8 Secrets must not be present"
if [[ -f .env ]]; then bad ".env is tracked in git - secrets must never be committed"; else ok ".env absent"; fi
if [[ -f .env.example ]]; then ok ".env.example present"; else bad ".env.example missing - judges cannot configure the app"; fi

step "3/8 Configure the documented environment"
if [[ -f .env.example ]]; then
  cp .env.example .env && ok "cp .env.example .env"
  if grep -qE '^MODEL_REF=mock' .env; then
    ok "defaults to the offline model - no credential needed"
  else
    bad "MODEL_REF does not default to mock: a judge without API keys cannot run this"
  fi
fi

step "4/8 Install from the lockfile"
if [[ -f pnpm-lock.yaml ]]; then
  if pnpm install --frozen-lockfile >/tmp/cr-install.log 2>&1; then
    ok "pnpm install --frozen-lockfile"
  else
    bad "install failed"; tail -20 /tmp/cr-install.log
  fi
else
  bad "pnpm-lock.yaml not committed - installs are not reproducible"
fi

has_script() { node -e "process.exit(require('./package.json').scripts?.['$1']?0:1)" 2>/dev/null; }

step "5/8 Seed demo data"
if has_script demo:seed; then
  pnpm demo:seed >/tmp/cr-seed.log 2>&1 && ok "pnpm demo:seed" || { bad "demo:seed failed"; tail -15 /tmp/cr-seed.log; }
else
  echo "   skip: no demo:seed script"
fi

step "6/8 Typecheck and test"
if has_script typecheck; then
  pnpm typecheck >/tmp/cr-tc.log 2>&1 && ok "pnpm typecheck" || { bad "typecheck failed"; tail -20 /tmp/cr-tc.log; }
fi
if has_script test; then
  pnpm test >/tmp/cr-test.log 2>&1 && ok "pnpm test" || { bad "tests failed"; tail -25 /tmp/cr-test.log; }
fi

step "7/8 Production build"
if has_script build; then
  if pnpm build >/tmp/cr-build.log 2>&1; then ok "pnpm build"; else bad "build failed"; tail -25 /tmp/cr-build.log; fi
else
  echo "   skip: no build script"
fi

step "8/8 Start and health-check"
# Refuse to run against a port something else already holds: a stale server from
# an earlier run would answer the health check and turn this into a false PASS.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  bad "port $PORT is already in use - stop that process, or set CLEAN_ROOM_PORT. Refusing to health-check someone else's server."
elif has_script start; then
  PORT="$PORT" pnpm start >/tmp/cr-start.log 2>&1 &
  SERVER_PID=$!
  healthy=0
  for _ in $(seq 1 30); do
    if curl -fsS "http://localhost:$PORT/api/health" >/tmp/cr-health.json 2>/dev/null; then healthy=1; break; fi
    sleep 1
  done
  if [[ $healthy -eq 1 ]]; then
    # A large uptime means we reached a long-lived server, not the one we just
    # started - treat that as a failure rather than a pass.
    uptime_s=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('/tmp/cr-health.json','utf8')).uptimeSeconds??0)}catch{console.log(0)}" 2>/dev/null || echo 0)
    if [[ "${uptime_s:-0}" -gt 300 ]]; then
      bad "health check answered by a server up for ${uptime_s}s - that is not the one this script started"
    else
      ok "GET /api/health -> $(head -c 160 /tmp/cr-health.json)"
    fi
  else
    bad "health check never succeeded on port $PORT"; tail -20 /tmp/cr-start.log
  fi
else
  echo "   skip: no start script"
fi

echo ""
if [[ $failures -eq 0 ]]; then
  echo "RESULT: PASS - a judge can reproduce this repository."
  exit 0
fi
echo "RESULT: BLOCKED - $failures failure(s). Fix before submitting."
exit 1
