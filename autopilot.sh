#!/usr/bin/env bash
# §25.2 self-healing runner. Runs the build headless; whenever Claude Code exits for ANY
# reason (usage limit, crash, disconnect) it waits and relaunches with a resume prompt,
# continuing automatically when the limit window resets. Stops only when BUILD-DONE appears.
# Usage: chmod +x autopilot.sh && ./autopilot.sh   (macOS: caffeinate -i ./autopilot.sh)
WAIT=300   # 5 min between retries; usage-limit windows reset on their own schedule
PROMPT_FIRST="Read HUMILEY-PROCUREMENT-SPEC.md completely and execute the full build in \
one-click mode per §24 with the checkpoint rules of §25.1. Build phases 1→17 without asking. \
Maintain .build-state.json and WIP commits at every task. Write BUILD-DONE when finished."
PROMPT_RESUME="RESUME per §25.1: read .build-state.json, git log, and docs/PHASE-REPORTS.md, \
then continue the one-click build (§24) from nextAction. Do not redo completed work. \
Do not ask questions. Write BUILD-DONE when Phase 17 and FINAL-REPORT.md are complete."

until [ -f BUILD-DONE ]; do
  if [ -f .build-state.json ]; then P="$PROMPT_RESUME"; else P="$PROMPT_FIRST"; fi
  claude -p "$P" --dangerously-skip-permissions --max-turns 1000 || true
  [ -f BUILD-DONE ] && break
  echo "$(date) — Claude Code stopped (limit/interruption). Retrying in $WAIT s…" | tee -a autopilot.log
  sleep $WAIT
done
echo "BUILD COMPLETE — review docs/FINAL-REPORT.md"
