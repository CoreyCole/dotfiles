#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_PI_DIR="$HOME/.pi"
EXPECTED_AGENT_DIR="$EXPECTED_PI_DIR/agent"

# Resolve symlinks before comparing.
RESOLVED_SCRIPT_DIR="$(cd "$SCRIPT_DIR" && pwd -P)"
RESOLVED_PI_DIR="$(cd "$EXPECTED_PI_DIR" 2>/dev/null && pwd -P || echo "")"

if [ "$RESOLVED_SCRIPT_DIR" != "$RESOLVED_PI_DIR" ]; then
    echo "This tracked config is expected to be symlinked as ~/.pi"
    echo "  Current location: $SCRIPT_DIR"
    echo "  Expected symlink target: $EXPECTED_PI_DIR"
    echo ""
    echo "  Run: ln -sfn \"$SCRIPT_DIR\" \"$EXPECTED_PI_DIR\""
    exit 1
fi

echo "Validating pi-config at $EXPECTED_PI_DIR"
echo ""

missing=0

require_dir() {
    local relative_path="$1"
    if [ ! -d "$EXPECTED_AGENT_DIR/$relative_path" ]; then
        echo "missing: agent/$relative_path directory"
        missing=1
        return
    fi
    echo "ok: agent/$relative_path directory"
}

require_file() {
    local relative_path="$1"
    if [ ! -f "$EXPECTED_AGENT_DIR/$relative_path" ]; then
        echo "missing: agent/$relative_path file"
        missing=1
        return
    fi
    echo "ok: agent/$relative_path file"
}

echo "Checking required Pi resource paths under ~/.pi/agent ..."
require_dir extensions
require_dir skills
require_dir agents
require_file settings.json
require_file mcp.json

if [ "$missing" -ne 0 ]; then
    echo ""
    echo "Pi config validation failed. Fix the missing path(s) above and rerun setup."
    exit 1
fi

echo ""
echo "Checking command-line dependencies ..."

if command -v pi >/dev/null 2>&1; then
    echo "ok: pi CLI is available"
else
    echo "warning: pi CLI not found"
    echo "  Install Pi before using this config. Configured packages are declared in:"
    echo "  $EXPECTED_AGENT_DIR/settings.json"
fi

if command -v parallel-cli >/dev/null 2>&1; then
    echo "ok: parallel-cli is available"
else
    echo "warning: parallel-cli not found"
    echo "  Required only for HazAT/pi-parallel tools such as parallel_search."
    echo "  See .pi-config/README.md for manual install and authentication options."
fi

echo ""
echo "Configured Pi packages are tracked in:"
echo "  $EXPECTED_AGENT_DIR/settings.json"
echo "Pi resolves missing configured packages into ~/.pi/agent/git/ during normal startup when online."
echo "For package visibility, run the Pi package list command manually."
echo ""
echo "Optional local TypeScript/LSP dependencies for extension editing are not installed by setup."
echo "If needed, install local npm dependencies manually from:"
echo "  $EXPECTED_PI_DIR"
echo ""
echo "Validation complete. Restart pi or run /reload to pick up config/resource changes."
