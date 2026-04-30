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

echo "Validating Pi resource paths under ~/.pi/agent ..."
mkdir -p "$EXPECTED_AGENT_DIR"

for dir in extensions skills agents; do
  if [ ! -d "$EXPECTED_AGENT_DIR/$dir" ]; then
    echo "agent/$dir directory not found"
    exit 1
  fi
  echo "agent/$dir exists"
done

for file in settings.json mcp.json; do
  if [ ! -f "$EXPECTED_AGENT_DIR/$file" ]; then
    echo "agent/$file not found"
    exit 1
  fi
  echo "agent/$file exists"
done

# Install git packages
echo "Installing packages..."
for package in \
  git:github.com/nicobailon/pi-subagents \
  git:github.com/nicobailon/pi-mcp-adapter \
  git:github.com/HazAT/pi-smart-sessions \
  git:github.com/HazAT/pi-parallel \
  git:git@github.com:CoreyCole/pi-deterministic-docs.git \
  git:github.com/algal/pi-context-inspect
do
  pi install "$package" 2>/dev/null || echo "  $package already installed"
done
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
