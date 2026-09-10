#!/usr/bin/env bash
# Last-line CWD for Herdr ui.tab_bar_right. Keep special_dirs in sync with
# scripts/tmux-status-context.sh and neovim-config/lua/winbar.lua.
set -euo pipefail

cwd=${HERDR_ACTIVE_PANE_CWD:-${1:-$PWD}}
home=${HOME:-}

short_path() {
    local path=$1
    local best_name=""
    local best_path=""

    local entries=(
        "DSUI:$home/cn/chestnut-flake/cn-agents/pkg/datastarui"
        "AGENTS:$home/cn/chestnut-flake/cn-agents"
        "VAMOS:$home/cn/chestnut-flake/vamos"
        "CN:$home/cn/chestnut-flake/monorepo"
        "DOTFILES:$home/dotfiles"
        "HOME:$home"
    )
    local dsui_dir dsui_checkout dsui_suffix
    for dsui_dir in "$home"/cn/chestnut-flake/cn-agents-*/pkg/datastarui; do
        [[ -d "$dsui_dir" ]] || continue
        dsui_checkout=${dsui_dir%/pkg/datastarui}
        dsui_checkout=${dsui_checkout##*/}
        dsui_suffix=${dsui_checkout#cn-agents}
        entries+=("DSUI$dsui_suffix:$dsui_dir")
    done

    local entry name dir parent base candidate candidate_name remainder suffix
    for entry in "${entries[@]}"; do
        name=${entry%%:*}
        dir=${entry#*:}
        [[ -n "$dir" ]] || continue

        parent=${dir%/*}
        base=${dir##*/}
        candidate=""

        if [[ "$path" == "$dir" || "$path" == "$dir"/* ]]; then
            candidate=$dir
            candidate_name=$name
        elif [[ "$path" == "$parent/$base"-* || "$path" == "$parent/$base"[0-9]* ]]; then
            remainder=${path#"$parent/"}
            candidate="$parent/${remainder%%/*}"
            suffix=${candidate##*/}
            suffix=${suffix#"$base"}
            candidate_name="$name$suffix"
        fi

        if [[ -n "$candidate" && ${#candidate} -gt ${#best_path} ]]; then
            best_name=$candidate_name
            best_path=$candidate
        fi
    done

    if [[ -n "$best_path" ]]; then
        local rest=${path#"$best_path"}
        rest=${rest#/}
        if [[ -n "$rest" ]]; then
            printf '%s  %s' "$best_name" "${rest//\//  }"
        else
            printf '%s' "$best_name"
        fi
        return
    fi

    printf '%s' "$path"
}

git_branch() {
    local path=$1

    command -v git >/dev/null 2>&1 || return 0
    git -C "$path" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0

    local branch
    branch=$(git -C "$path" branch --show-current 2>/dev/null || true)
    if [[ -z "$branch" ]]; then
        branch=$(git -C "$path" rev-parse --short HEAD 2>/dev/null || true)
    fi

    [[ -n "$branch" ]] && printf '%s' "$branch"
}

display_path=$(short_path "$cwd")
branch=$(git_branch "$cwd")

if [[ -n "$branch" ]]; then
    printf '%s   %s\n' "$display_path" "$branch"
else
    printf '%s\n' "$display_path"
fi
