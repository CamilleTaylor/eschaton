#!/usr/bin/env bash
# Timestamps any new registry heads with OpenTimestamps, upgrades older proofs, rebuilds the offline bundle,
# and commits. Free: OpenTimestamps calendars aggregate hashes into Bitcoin transactions at no cost.
# Usage (in GitHub Actions): bash tools/stamp.sh "commit message"
set -euo pipefail
MSG="${1:-Update registry}"
pip install --quiet opentimestamps-client >/dev/null 2>&1 || echo "::warning::could not install opentimestamps-client; skipping stamps"
if command -v ots >/dev/null 2>&1; then
  for f in data/stamps/head-*.txt; do
    [ -e "$f" ] || continue
    if [ ! -e "$f.ots" ]; then ots stamp "$f" || echo "::warning::ots stamp failed for $f"; fi
  done
  # Proofs start "pending" and become complete once the calendar's Bitcoin transaction confirms (hours).
  for p in data/stamps/head-*.txt.ots; do [ -e "$p" ] && (ots upgrade "$p" >/dev/null 2>&1 || true); done
fi
node tools/bundle.mjs
git config user.name "eschaton-bot"
git config user.email "eschaton-bot@users.noreply.github.com"
git add data
if git diff --cached --quiet; then echo "No changes"; exit 0; fi
git commit -m "$MSG"
for i in 1 2 3; do git pull --rebase --quiet && git push && exit 0; sleep 5; done
echo "push failed"; exit 1
