# rcmd-style application activation on Hyprland

## Behavioral model

[rcmd](https://lowtechguys.com/rcmd) maps a modifier plus a letter to an application. macOS application activation raises that application's windows as a group. The developer describes the design and same-letter selection behavior in [A window switcher on the Mac App Store?](https://alinpanaitiu.com/blog/window-switcher-app-store/).

Hyprland exposes windows independently; it has no application-level activation operation. In a tiled workflow, the closest useful equivalent is:

1. Query matching windows with `hyprctl clients -j` and stable window classes.
1. Select the match with the lowest `focusHistoryID`, Hyprland's most recently focused window.
1. Use `focuswindow address:<address>` once; Hyprland switches to that window's workspace automatically.

See the official [Hyprland dispatchers](https://wiki.hypr.land/Configuring/Dispatchers/) and [window rules](https://wiki.hypr.land/Configuring/Window-Rules/) documentation.

## Local implementation

- Script: `~/.config/hypr/scripts/rcmd-focus.sh`
- Bindings: `~/.config/hypr/bindings.lua`
- Discover classes: `hyprctl clients -j | jq -r '.[] | [.class, .title] | @tsv'`

The script accepts a primary class regex and optional additional regexes. `--cycle-window` traverses a stable MRU snapshot of matching windows; its runtime state prevents Hyprland's updated focus history from bouncing between only the two newest windows. `--cycle-app` selects the next running class regex when a letter is assigned to multiple applications.

Do not focus every matching window in sequence to imitate macOS application raising. In Hyprland that produces visible focus-ring flashes and adds no value for tiled windows.

## Automatic game mode

The `games` table in `bindings.lua` uses exact class matches with optional exact title matches. Find values with:

```bash
hyprctl clients -j | jq '.[] | {class, title}'
```

Keep the title for StarCraft II: `steam_app_battlenet` can also identify the Battle.net launcher.

When a listed game has focus, the four Alt+X/Z desktop bindings are disabled and Caps Lock works normally. Leaving the game restores the bindings and Caps Lock → Escape. Right Alt remains Compose. Focus, title, class, and config-reload events update the mode without polling.

Use `hl.bind()` handles here: Omarchy's `o.bind()` helper does not return the handle needed by `set_enabled()`. A handler that only returns early would still consume the shortcut instead of passing it to the game.

Hyprland must receive the original Caps Lock key. On this machine, `/etc/keyd/default.conf` separately maps `capslock = escape`. Disable that duplicate remapper once:

```bash
sudo systemctl disable --now keyd
```

This leaves Caps Lock normal in TTYs. Hyprland owns the desktop/game mapping. Disabling keyd is machine-local state, not part of the dotfiles checkout.

Run the mocked focus/matching/reload checks from the dotfiles root:

```bash
lua .config/hypr/tests/game-mode.lua
```

API references: [Hyprland Lua utilities](https://wiki.hypr.land/configuring/core/advanced-configuration/lua-utilities/) and [binds](https://wiki.hypr.land/configuring/core/binds/).
