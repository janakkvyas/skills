#!/usr/bin/env bash
# Month-end routine for the paper-trading account.
#
#   ./month_end.sh            rebalance (if a new month has started), status, commit, push
#   ./month_end.sh --no-push  same, but leave the commit local
#
# Safe to run on any day: `paper.py rebalance` refuses to act twice in one
# calendar month, so a run on the 1st does the month-end rebalance and a run
# mid-month only refreshes `status`.
set -euo pipefail

cd "$(dirname "$0")"
PUSH=1
[[ "${1:-}" == "--no-push" ]] && PUSH=0

python3 -m pip install -q -r requirements.txt 2>&1 | grep -v WARNING || true

mkdir -p paper
LOG="paper/cron.log"
{
  echo "===== $(date -u +'%Y-%m-%d %H:%M UTC') ====="
  python3 paper.py rebalance
  echo
  python3 paper.py status
} 2>&1 | tee -a "$LOG"

if git diff --quiet -- paper; then
  echo "No account changes to commit."
  exit 0
fi

git add paper
git -c user.name="${GIT_AUTHOR_NAME:-paper-trader}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-paper-trader@users.noreply.github.com}" \
    commit -q -m "paper: month-end run $(date -u +%Y-%m-%d)"
echo "Committed."
if [[ $PUSH -eq 1 ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git push -u origin "$BRANCH"
  echo "Pushed to $BRANCH."
fi
