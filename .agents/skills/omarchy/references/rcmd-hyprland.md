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
- Bindings: `~/.config/hypr/bindings.conf`
- Discover classes: `hyprctl clients -j | jq -r '.[] | [.class, .title] | @tsv'`

The script accepts a primary class regex and optional additional regexes. `--cycle-app` selects the next running regex, providing the same-letter application cycle without changing window placement.

Do not focus every matching window in sequence to imitate macOS application raising. In Hyprland that produces visible focus-ring flashes and adds no value for tiled windows.
