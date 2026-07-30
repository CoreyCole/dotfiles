#!/usr/bin/env bash

set -euo pipefail

mode=primary
if [[ ${1:-} == --cycle-app ]]; then
  mode=cycle
  shift
fi

key=${1:?missing key}
shift
patterns=("$@")

if ((${#patterns[@]} == 0)); then
  exit 2
fi

clients=$(hyprctl clients -j)
active_class=$(hyprctl activewindow -j | jq -r '.class // ""')
selected_pattern=${patterns[0]}

if [[ $mode == cycle ]]; then
  running_patterns=()
  for pattern in "${patterns[@]}"; do
    if jq -e --arg pattern "$pattern" 'any(.[]; .class | test($pattern; "i"))' <<<"$clients" >/dev/null; then
      running_patterns+=("$pattern")
    fi
  done

  if ((${#running_patterns[@]} > 0)); then
    selected_pattern=${running_patterns[0]}
    for index in "${!running_patterns[@]}"; do
      pattern=${running_patterns[$index]}
      if [[ $active_class =~ $pattern ]]; then
        selected_pattern=${running_patterns[$(((index + 1) % ${#running_patterns[@]}))]}
        break
      fi
    done
  fi
fi

matches=$(jq --arg pattern "$selected_pattern" '[.[] | select(.class | test($pattern; "i"))]' <<<"$clients")
if [[ $(jq 'length' <<<"$matches") -eq 0 ]]; then
  notify-send "No application windows" "No running windows are assigned to Alt+$key"
  exit 0
fi

preferred_address=$(jq -r 'min_by(.focusHistoryID).address' <<<"$matches")
hyprctl dispatch focuswindow "address:$preferred_address" >/dev/null
