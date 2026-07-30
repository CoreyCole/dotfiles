#!/usr/bin/env bash

set -euo pipefail

mode=primary
if [[ ${1:-} == --cycle-app ]]; then
  mode=cycle-app
  shift
elif [[ ${1:-} == --cycle-window ]]; then
  mode=cycle-window
  shift
fi

key=${1:?missing key}
shift
patterns=("$@")

if ((${#patterns[@]} == 0)); then
  exit 2
fi

clients=$(hyprctl clients -j)
active_window=$(hyprctl activewindow -j)
active_address=$(jq -r '.address // ""' <<<"$active_window")
active_class=$(jq -r '.class // ""' <<<"$active_window")
selected_pattern=${patterns[0]}

if [[ $mode == cycle-app ]]; then
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

if [[ $mode == cycle-window ]]; then
  runtime_dir=${XDG_RUNTIME_DIR:-/tmp}
  state_file="$runtime_dir/rcmd-focus-$key.json"
  current_set=$(jq -c '[.[].address] | sort' <<<"$matches")
  sequence=$(jq -c 'sort_by(.focusHistoryID) | map(.address)' <<<"$matches")
  next_index=0

  if [[ -f $state_file ]]; then
    stored_set=$(jq -c '.addresses | sort' "$state_file" 2>/dev/null || true)
    stored_address=$(jq -r '.addresses[.index] // ""' "$state_file" 2>/dev/null || true)
    if [[ $stored_set == "$current_set" && $stored_address == "$active_address" ]]; then
      sequence=$(jq -c '.addresses' "$state_file")
      current_index=$(jq -r '.index' "$state_file")
      count=$(jq 'length' <<<"$sequence")
      next_index=$(((current_index + 1) % count))
    fi
  fi

  if [[ $next_index -eq 0 ]]; then
    active_index=$(jq -r --arg address "$active_address" 'index($address) // -1' <<<"$sequence")
    if [[ $active_index -ge 0 ]]; then
      count=$(jq 'length' <<<"$sequence")
      next_index=$(((active_index + 1) % count))
    fi
  fi

  preferred_address=$(jq -r --argjson index "$next_index" '.[$index]' <<<"$sequence")
  umask 077
  jq -n --argjson addresses "$sequence" --argjson index "$next_index" \
    '{addresses: $addresses, index: $index}' >"$state_file"
fi

hyprctl dispatch focuswindow "address:$preferred_address" >/dev/null
