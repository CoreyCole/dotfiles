#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/dotfiles-backups/$(date +%Y%m%d-%H%M%S)"
backed_up=0

if [[ $(. /etc/os-release && printf '%s' "$ID") != "arch" ]]; then
    echo "This setup is for Arch Linux; found a different operating system."
    exit 1
fi

link() {
    local source="$1"
    local destination="$2"
    local source_path destination_path backup

    source_path="$(realpath -e "$source")"
    destination_path="$(realpath -m "$destination")"

    if [[ "$source_path" == "$destination_path" ]]; then
        echo "ok: $destination -> $source_path"
        return
    fi

    if [[ -e "$destination" || -L "$destination" ]]; then
        backup="$BACKUP_DIR/${destination#"$HOME/"}"
        mkdir -p "$(dirname "$backup")"
        mv "$destination" "$backup"
        backed_up=1
        echo "backup: $destination -> $backup"
    fi

    mkdir -p "$(dirname "$destination")"
    ln -s "$source_path" "$destination"
    echo "link: $destination -> $source_path"
}

# Shell and CLI configuration.
link "$REPO_DIR/.gitconfig" "$HOME/.gitconfig"
link "$REPO_DIR/.zshrc" "$HOME/.zshrc"
link "$REPO_DIR/.zsh_aliases" "$HOME/.zsh_aliases"
link "$REPO_DIR/.tmux.conf" "$HOME/.tmux.conf"
link "$REPO_DIR/.wezterm.lua" "$HOME/.wezterm.lua"
link "$REPO_DIR/direnv.toml" "$HOME/.config/direnv/direnv.toml"
link "$REPO_DIR/neovim-config" "$HOME/.config/nvim"
link "$REPO_DIR/.pi-config" "$HOME/.pi"

# Whole-directory XDG configurations that contain no generated state.
for config in alacritty bat fastfetch ghostty hypr kitty lazygit usql uwsm walker waybar; do
    link "$REPO_DIR/.config/$config" "$HOME/.config/$config"
done

# File-level links preserve application-generated state in their parent directories.
link "$REPO_DIR/.config/btop/btop.conf" "$HOME/.config/btop/btop.conf"
link "$REPO_DIR/.config/mimeapps.list" "$HOME/.config/mimeapps.list"
link "$REPO_DIR/.config/starship.toml" "$HOME/.config/starship.toml"
link "$REPO_DIR/.config/xdg-terminals.list" "$HOME/.config/xdg-terminals.list"

for config in profile conf/clipboard.conf conf/keyboard.conf conf/notifications.conf conf/xcb.conf; do
    link "$REPO_DIR/.config/fcitx5/$config" "$HOME/.config/fcitx5/$config"
done

# Omarchy owns generated current-theme state; only link the tracked theme source.
link "$REPO_DIR/.config/omarchy/themes/tokyo-night-black" \
    "$HOME/.config/omarchy/themes/tokyo-night-black"
link "$REPO_DIR/.config/omarchy/backgrounds/tokyo-night-black" \
    "$HOME/.config/omarchy/backgrounds/tokyo-night-black"

if [[ "$backed_up" -eq 1 ]]; then
    echo "Existing paths were backed up under: $BACKUP_DIR"
fi
