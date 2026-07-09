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

client_width=${2:-0}

truncate_text() {
    local text=$1
    local max=$2

    if ((max <= 0)); then
        return
    fi
    if ((${#text} <= max)); then
        printf '%s' "$text"
        return
    fi
    if ((max <= 1)); then
        printf '…'
        return
    fi

    printf '%s…' "${text:0:max-1}"
}

context_width_limit() {
    local width=$1
    local limit

    if ((width <= 0)); then
        printf '120'
        return
    fi

    # Use a fraction of the terminal so the tmux window list keeps priority,
    # but do not punish naturally short contexts like "DOTFILES  main".
    if ((width < 80)); then
        limit=$((width * 40 / 100))
    else
        limit=$((width * 50 / 100))
    fi

    if ((limit < 20)); then
        limit=20
    elif ((limit > 120)); then
        limit=120
    fi
    printf '%s' "$limit"
}

plain_display_path=$(short_path "$cwd")
plain_branch=$(git_branch "$cwd")
max_context_width=$(context_width_limit "$client_width")

branch_suffix=""
if [[ -n "$plain_branch" ]]; then
    branch_suffix="  $plain_branch"
fi

# Prefer showing branch when it fits, but drop it before reducing the path to
# an unhelpful stub. This keeps short contexts complete while preventing very
# long cwd+branch strings from hiding tmux window tabs.
if [[ -n "$branch_suffix" && $((${#plain_display_path} + ${#branch_suffix})) -gt $max_context_width ]]; then
    path_width_with_branch=$((max_context_width - ${#branch_suffix}))
    if ((path_width_with_branch < 20)); then
        branch_suffix=""
    fi
fi

path_width=$((max_context_width - ${#branch_suffix}))
display_path=$(escape_tmux "$(truncate_text "$plain_display_path" "$path_width")")
branch_suffix=$(escape_tmux "$branch_suffix")

printf '#[fg=#808080]%s' "$display_path"
if [[ -n "$branch_suffix" ]]; then
    printf ' #[fg=#4a7a9b]%s' "${branch_suffix# }"
fi
