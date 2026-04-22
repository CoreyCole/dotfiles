#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_DIR="$HOME/.pi/agent"

# Resolve symlinks before comparing
RESOLVED_SCRIPT_DIR="$(cd "$SCRIPT_DIR" && pwd -P)"
RESOLVED_EXPECTED_DIR="$(cd "$EXPECTED_DIR" 2>/dev/null && pwd -P || echo "")"

if [ "$RESOLVED_SCRIPT_DIR" != "$RESOLVED_EXPECTED_DIR" ]; then
  echo "This config should be symlinked directly to ~/.pi/agent/"
  echo "  Current location: $SCRIPT_DIR"
  echo "  Expected symlink target: $EXPECTED_DIR"
  echo ""
  echo "  Pi resolves global settings, extensions, skills, and themes relative to ~/.pi/agent/."
  echo "  Do not symlink ~/.pi itself or add another nested agent/ directory inside the tracked config."
  echo ""
  echo "  Run: mkdir -p \"$HOME/.pi\" && ln -sfn \"$SCRIPT_DIR\" \"$EXPECTED_DIR\""
  exit 1
fi

echo "Setting up pi-config at $EXPECTED_DIR"
echo ""

# Create settings.json if it doesn't exist
if [ ! -f "$SCRIPT_DIR/settings.json" ]; then
  echo "settings.json not found — this shouldn't happen if you're running from dotfiles"
  exit 1
else
  echo "settings.json exists"
fi

# Install git packages
echo "Installing packages..."
pi install git:github.com/HazAT/pi-subagents 2>/dev/null || echo "  pi-subagents already installed"
pi install git:github.com/nicobailon/pi-mcp-adapter 2>/dev/null || echo "  pi-mcp-adapter already installed"
pi install git:github.com/HazAT/pi-smart-sessions 2>/dev/null || echo "  pi-smart-sessions already installed"
pi install git:github.com/HazAT/pi-parallel 2>/dev/null || echo "  pi-parallel already installed"
pi install git:git@github.com:sasha-computer/pi-cmux.git 2>/dev/null || echo "  pi-cmux already installed"
echo ""

echo "Setup complete!"
echo ""
echo "Restart pi to pick up all changes."
