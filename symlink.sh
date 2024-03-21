#!/bin/bash

src_dir="/tmp/lockbook/dotfiles/neovim-config/"
target_dir="$HOME/.config/nvim/"

# Check if the target directory exists
if [ -d "$target_dir" ] || [ -L "$target_dir" ]; then
    echo "The target directory or symlink $target_dir already exists."
    echo "Please remove or rename it before creating the symlink."
else
    # Create the symbolic link
    ln -s "$src_dir" "$target_dir"
    echo "Symlink created from $src_dir to $target_dir"
fi
