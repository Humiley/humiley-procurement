#!/usr/bin/env bash
# §24 Option B — fully scripted build. Each phase gets a fresh session (no context
# exhaustion); finished phases are skipped on re-run. If anything stops, just run again.
# Usage: chmod +x build-all.sh && ./build-all.sh
set -e
for N in $(seq 1 17); do
  [ -f ".done-phase-$N" ] && continue
  claude -p "Read HUMILEY-PROCUREMENT-SPEC.md. One-click mode (§24), no questions. \
Execute EXACTLY Phase $N as defined in §12 and prompt $N of §22.7. \
Verify DoD §22.6 + the phase's acceptance criteria, append the Phase Report to \
docs/PHASE-REPORTS.md, and commit as 'phase-$N'." \
    --dangerously-skip-permissions --max-turns 400
  npm run check || { echo "Phase $N failed check — fix before rerun"; exit 1; }
  touch ".done-phase-$N"
  echo "=== Phase $N complete ==="
done
echo "BUILD COMPLETE — review docs/FINAL-REPORT.md"
