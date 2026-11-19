# Monitor Configuration

Omarchy Quattro configures displays in `~/.config/hypr/monitors.lua`, not `monitors.conf`. Match outputs with `desc:` so a dock cannot hand the rule to a different port.

## Use `desc:` matching for multi-monitor setups

Match monitors by EDID description instead of port name. This is essential for **DisplayLink docks** where port names (DVI-I-3, DVI-I-4) can shift when monitors are added or removed.

```bash
# Find monitor descriptions
hyprctl monitors | grep description
```

```conf
# Match by model name — follows the monitor, not the cable
monitor = desc:Dell Inc. DELL U2717D, 2560x1440, 0x0, 1, transform, 1
monitor = desc:LG Electronics 32GK650G, 2560x1440, 1440x0, 1
monitor = desc:LG Electronics LG TV, 3840x2160, 4000x0, 1

# Fallback for any unrecognized monitor
monitor = , preferred, auto, 1
```

Do not pin `workspace = 1, monitor:...` here. Quattro workspace numbers come from the block file below, not from a global monitor pin.

## One shared 1–10, not 1–5 on every bar

Quattro gives every monitor its own workspaces 1–10. The stock bar always draws the first five of that monitor's block, labeled 1–5. Swapping `~/.local/state/omarchy/monitor-workspaces` does not remove 1/2/3 from the LG bar.

This machine wants one strip: vertical 1–3, LG 4–6, TV 7–10. That lives in `workspace_groups` in `~/.config/hypr/monitors.lua`. Super+number is rebound there. The bar clone `~/.config/omarchy/plugins/coreycole.workspaces/` shows only that screen's numbers. Do not pin global ids with `hl.workspace_rule`; Omarchy's reconciler renumbers them back into the monitor's block.

Sources: `/usr/share/omarchy/default/hypr/monitor-workspaces.lua`, `/usr/share/omarchy/shell/plugins/bar/widgets/Workspaces.qml`, [Hyprland monitors](https://wiki.hypr.land/Configuring/Basics/Monitors/).

## Why not port-based matching?

Port names like `DVI-I-3` are assigned by the kernel/driver at enumeration time. With DisplayLink docks, unplugging one monitor can cause remaining monitors to shift to different port names. A monitor configured for portrait on port A will rotate the wrong monitor if it moves to that port.

`desc:` rules bind config to the monitor's identity, making the setup robust to any combination of monitors being connected.
