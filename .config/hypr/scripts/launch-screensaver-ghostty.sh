#!/bin/bash

# Launch Omarchy screensaver explicitly in Ghostty, regardless of default terminal.

# Exit early if we don't have the tte show
if ! command -v tte &>/dev/null; then
  exit 1
fi

# Exit early if screensaver is already running
pgrep -f org.omarchy.screensaver && exit 0

# Allow screensaver to be turned off but also force started
if [[ -f ~/.local/state/omarchy/toggles/screensaver-off ]] && [[ $1 != "force" ]]; then
  exit 1
fi

# Silently quit Walker on overlay
walker -q

focused=$(hyprctl monitors -j | jq -r '.[] | select(.focused == true).name')

for m in $(hyprctl monitors -j | jq -r '.[] | .name'); do
  hyprctl dispatch focusmonitor "$m"

  hyprctl dispatch exec -- \
    ghostty --class=org.omarchy.screensaver \
    --config-file=~/.local/share/omarchy/default/ghostty/screensaver \
    --font-size=18 \
    -e omarchy-cmd-screensaver

done

hyprctl dispatch focusmonitor "$focused"
