#!/bin/bash
# Show what would reach the graded repository, and what stays local.
#
#   bash scripts/what-ships.sh
#
# A graded repository should contain the solution and the documents an expert
# needs to run and evaluate it - not the machinery that produced it. Run this
# before the final push and check nothing is in the wrong column.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1

echo "SHIPS — tracked, will be evaluated"
echo ""
git ls-files 2>/dev/null | sed 's|/[^/]*$||' | sort -u | head -40 | sed 's/^/  /'
echo ""
printf "  %s tracked files\n" "$(git ls-files 2>/dev/null | wc -l | tr -d ' ')"

echo ""
echo "STAYS LOCAL — present but ignored"
echo ""
git status --porcelain --ignored 2>/dev/null \
  | awk '$1=="!!"{print $2}' \
  | grep -vE 'node_modules|\.next|\.git/' \
  | sort -u | head -25 | sed 's/^/  /'

echo ""
echo "CHECKS"
for f in README.md EXTERNAL_MATERIALS.md .env.example; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 \
    && echo "  ok      $f is tracked" \
    || echo "  MISSING $f must be tracked - it is required"
done
for f in .env .claude/settings.local.json; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    echo "  DANGER  $f is TRACKED and must not be"
  fi
done
if git ls-files 2>/dev/null | grep -qE '^docs/.*_TEMPLATE\.md$'; then
  echo "  note    doc templates are tracked - fine if you filled them in, noise if not"
fi
if git ls-files 2>/dev/null | grep -q '^\.claude/'; then
  echo "  note    .claude/ is tracked - permitted (AI tooling is allowed), but it is"
  echo "          preparation-kit tooling rather than the Project. Disclose it in"
  echo "          EXTERNAL_MATERIALS.md if you keep it."
fi
echo ""
echo "Required by 5.4.15 — confirm the README carries all eight:"
echo "  purpose · architecture · technologies · installation · startup ·"
echo "  dependencies · environment parameters · procedure for checking the main scenario"
