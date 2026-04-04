# Monitor Configuration (`~/.config/hypr/monitors.conf`)

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

Workspace assignments also support `desc:`:
```conf
workspace = 1, monitor:desc:Dell Inc. DELL U2717D, default:true, persistent:true
workspace = 4, monitor:desc:LG Electronics 32GK650G, default:true, persistent:true
```

## Why not port-based matching?

Port names like `DVI-I-3` are assigned by the kernel/driver at enumeration time. With DisplayLink docks, unplugging one monitor can cause remaining monitors to shift to different port names. A monitor configured for portrait on port A will rotate the wrong monitor if it moves to that port.

`desc:` rules bind config to the monitor's identity, making the setup robust to any combination of monitors being connected.
