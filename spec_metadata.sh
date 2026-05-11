#!/usr/bin/env bash
set -euo pipefail

# Collect metadata
# Use an explicit zoneinfo path. On this system, TZ=America/Los_Angeles is
# parsed as a POSIX TZ string with abbreviation "America" and UTC offset 0;
# TZ=:/usr/share/zoneinfo/... forces IANA zoneinfo handling.
LA_TZ=:/usr/share/zoneinfo/America/Los_Angeles
DATETIME_TZ=$(TZ=$LA_TZ date '+%Y-%m-%d %H:%M:%S %Z')
FILENAME_TS=$(TZ=$LA_TZ date '+%Y-%m-%d_%H-%M-%S')

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	REPO_NAME=$(basename "$(git remote get-url origin 2>/dev/null || git rev-parse --show-toplevel)" .git)
	GIT_BRANCH=$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD)
	GIT_COMMIT=$(git rev-parse HEAD)
	GIT_USERNAME=$(git config user.name 2>/dev/null || echo "unknown")
else
	REPO_NAME=""
	GIT_BRANCH=""
	GIT_COMMIT=""
	GIT_USERNAME=""
fi

# Print similar to the individual command outputs
echo "Current Date/Time (TZ): $DATETIME_TZ"
[ -n "$GIT_USERNAME" ] && echo "Git Username: $GIT_USERNAME -> write to \`thoughts/$GIT_USERNAME\` (not \`thoughts/shared\`)"
[ -n "$GIT_COMMIT" ] && echo "Current Git Commit Hash: $GIT_COMMIT"
[ -n "$GIT_BRANCH" ] && echo "Current Branch Name: $GIT_BRANCH"
[ -n "$REPO_NAME" ] && echo "Repository Name: $REPO_NAME"
echo "Timestamp For Filename: $FILENAME_TS"
