#!/usr/bin/env bash
set -euo pipefail

hypr_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/hypr"
mkdir -p -- "$cache_dir"
build_dir=$(mktemp -d "$cache_dir/.caps-lock-reset.XXXXXX")
trap 'rm -rf -- "$build_dir"' EXIT

read -r -a cflags <<< "$(pkg-config --cflags hyprland xkbcommon lua)"
read -r -a libs <<< "$(pkg-config --libs xkbcommon)"
# Hyprland's inline manager globals must share the compositor's exported symbols.
"${CXX:-c++}" -std=c++23 -O2 -shared -fPIC -fvisibility=default -Wall -Wextra \
  "${cflags[@]}" "$hypr_dir/plugins/caps-lock-reset/main.cpp" \
  -o "$build_dir/caps-lock-reset.so" "${libs[@]}" -ldl

mv -f -- "$build_dir/caps-lock-reset.so" "$cache_dir/caps-lock-reset.so"
printf 'Built %s\n' "$cache_dir/caps-lock-reset.so"
printf 'The build does not load the plugin or change Hyprland config.\n'
