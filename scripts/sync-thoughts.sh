#!/bin/bash
set -euo pipefail

# Delegate to the canonical cn-agents thoughts sync script.
# All local thoughts symlinks point at ~/cn/chestnut-flake/cn-agents/thoughts,
# and cn-agents owns the current sync policy.
CN_AGENTS_REPO="${CN_AGENTS_REPO:-$HOME/cn/chestnut-flake/cn-agents}"
SYNC_SCRIPT="$CN_AGENTS_REPO/scripts/sync-thoughts.sh"

if [ ! -d "$CN_AGENTS_REPO/.git" ]; then
    echo "Error: cn-agents repository not found at $CN_AGENTS_REPO" >&2
    exit 1
fi

if [ ! -x "$SYNC_SCRIPT" ]; then
    echo "Error: sync script not executable at $SYNC_SCRIPT" >&2
    exit 1
fi

cd "$CN_AGENTS_REPO"
exec "$SYNC_SCRIPT"
