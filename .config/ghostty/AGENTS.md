# Ghostty Config Notes

This directory is the source of truth for Ghostty config:

- `~/dotfiles/.config/ghostty/config`
- `~/.config/ghostty` should symlink to `~/dotfiles/.config/ghostty`
- On macOS, `~/Library/Application Support/com.mitchellh.ghostty/config` should also symlink to `~/dotfiles/.config/ghostty/config` because Ghostty loads macOS-specific config after XDG config.
- NixOS Home Manager should point `~/.config/ghostty` at `~/dotfiles/.config/ghostty`; do not maintain a separate `ghostty.linux` duplicate.

Ghostty does **not** hot-reload config on file save. After editing `config`:

1. Validate the config:

   ```bash
   /Applications/Ghostty.app/Contents/MacOS/ghostty +show-config --changes-only >/tmp/ghostty-config.out 2>/tmp/ghostty-config.err
   ```

1. Reload the running macOS Ghostty app. Prefer Ghostty's AppleScript action API:

   ```bash
   osascript <<'APPLESCRIPT'
   tell application "Ghostty"
     perform action "reload_config" on focused terminal of selected tab of front window
   end tell
   APPLESCRIPT
   ```

   This may require macOS Automation permission for the calling app/terminal to control Ghostty.

1. If the action API is unavailable, try sending Ghostty's default macOS reload shortcut (`cmd+shift+,`) via System Events:

   ```bash
   osascript -e 'tell application "Ghostty" to activate' \
     -e 'tell application "System Events" to keystroke "," using {command down, shift down}'
   ```

   This may require Accessibility permission for the calling app/terminal.

If both AppleScript reload methods fail because permissions are missing, tell the user to reload manually with `cmd+shift+,` or restart Ghostty.

Note: when running inside tmux, macOS permission prompts may name the terminal app that originally started the tmux server, not the terminal currently attached to it. For example, a tmux server created from WezTerm and later attached from Ghostty can still make `osascript` permission prompts say WezTerm.
