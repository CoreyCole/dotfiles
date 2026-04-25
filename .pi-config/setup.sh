#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_PI_DIR="$HOME/.pi"
EXPECTED_AGENT_DIR="$EXPECTED_PI_DIR/agent"

# Resolve symlinks before comparing
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

echo "Setting up pi-config at $EXPECTED_PI_DIR"
echo ""

echo "Ensuring Pi auto-discovery paths exist under ~/.pi/agent ..."
mkdir -p "$EXPECTED_AGENT_DIR"
ln -sfn ../extensions "$EXPECTED_AGENT_DIR/extensions"
ln -sfn ../skills "$EXPECTED_AGENT_DIR/skills"
ln -sfn ../agents "$EXPECTED_AGENT_DIR/agents"
ln -sfn ../mcp.json "$EXPECTED_AGENT_DIR/mcp.json"

# Create/validate active settings.json
if [ ! -f "$EXPECTED_AGENT_DIR/settings.json" ]; then
  echo "agent/settings.json not found"
  exit 1
else
  echo "agent/settings.json exists"
fi

# Install git packages
echo "Installing packages..."
pi install git:github.com/HazAT/pi-subagents 2>/dev/null || echo "  pi-subagents already installed"
pi install git:github.com/nicobailon/pi-mcp-adapter 2>/dev/null || echo "  pi-mcp-adapter already installed"
pi install git:github.com/HazAT/pi-smart-sessions 2>/dev/null || echo "  pi-smart-sessions already installed"
pi install git:github.com/HazAT/pi-parallel 2>/dev/null || echo "  pi-parallel already installed"
pi install git:git@github.com:sasha-computer/pi-cmux.git 2>/dev/null || echo "  pi-cmux already installed"
echo ""

echo "Checking parallel-cli dependency for pi-parallel..."
if command -v parallel-cli >/dev/null 2>&1; then
  echo "  parallel-cli is installed"
else
  if command -v curl >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
    echo "  parallel-cli not found; installing via Parallel's standalone installer..."
    curl -fsSL https://parallel.ai/install.sh | bash
    echo "  Installed parallel-cli"
  else
    echo "  parallel-cli not found and curl/bash are unavailable"
    echo "  Install it manually with: curl -fsSL https://parallel.ai/install.sh | bash"
    exit 1
  fi
fi

echo ""
echo "If this is your first time using pi-parallel, authenticate once with:"
echo "  parallel-cli login"
echo "Or set:"
echo "  export PARALLEL_API_KEY=your_api_key"
echo ""
echo "Setup complete!"
echo ""
echo "Restart pi to pick up all changes."
