#!/usr/bin/env bash
set -euo pipefail

cwd=${1:-$PWD}
home=${HOME:-}

escape_tmux() {
    # Escape literal # so tmux does not treat path/branch text as a format.
    printf '%s' "$1" | sed 's/#/##/g'
}

short_path() {
    local path=$1
    local best_name=""
    local best_path=""

    # Keep this in sync with neovim-config/lua/winbar.lua special_dirs.
    local entries=(
        "DSUI:$home/cn/chestnut-flake/cn-agents/pkg/datastarui"
        "AGENTS:$home/cn/chestnut-flake/cn-agents"
        "VAMOS:$home/cn/chestnut-flake/vamos"
        "CN:$home/cn/chestnut-flake/monorepo"
        "DOTFILES:$home/dotfiles"
        "HOME:$home"
    )
    local dsui_dir agent_checkout agent_suffix
    for dsui_dir in "$home"/cn/chestnut-flake/cn-agents-*/pkg/datastarui; do
        [[ -d "$dsui_dir" ]] || continue
        agent_checkout=${dsui_dir#"$home/cn/chestnut-flake/"}
        agent_checkout=${agent_checkout%%/*}
        agent_suffix=${agent_checkout#cn-agents}
        entries+=("DSUI$agent_suffix:$dsui_dir")
    done

    local entry name dir parent base candidate candidate_name remainder suffix
    for entry in "${entries[@]}"; do
        name=${entry%%:*}
        dir=${entry#*:}
        [[ -n "$dir" ]] || continue

        # Match the canonical checkout, plus sibling feature checkouts such as
        # vamos-*, cn-agents-*, monorepo-*, and numbered monorepo2/monorepo3
        # workspaces without showing the full ~/cn/chestnut-flake prefix.
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

display_path=$(escape_tmux "$(short_path "$cwd")")
branch=$(git_branch "$cwd")
branch=$(escape_tmux "$branch")

printf '#[fg=#808080]%s' "$display_path"
if [[ -n "$branch" ]]; then
    printf ' #[fg=#4a7a9b] %s' "$branch"
fi
