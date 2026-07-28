#!/bin/bash

# Delegate to Omarchy's maintained screensaver launcher so terminal-specific
# configuration and command names stay compatible with Omarchy updates.
exec omarchy-launch-screensaver "$@"
