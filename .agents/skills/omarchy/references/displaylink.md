# DisplayLink Docks

## Required Packages

- `displaylink` (AUR) — proprietary DisplayLink Manager daemon
- `evdi-dkms` (AUR) — kernel module for virtual display devices
- `displaylink.service` — must be enabled via systemd

## How It Works

DisplayLink monitors appear as `DVI-I-*` connectors on EVDI virtual cards (`/dev/dri/card*` backed by `evdi.N` platform devices). The DisplayLink daemon compresses framebuffer data and sends it over USB to the dock's chipset.

## Hybrid Docks (DisplayLink + DP Alt Mode)

Some docks (e.g., Plugable UD-6950PDZ with DL-6950 chipset) combine two technologies:

- **2 outputs** use DisplayLink — appear as `DVI-I-*` connectors, driven by EVDI
- **1 output** uses USB-C DP Alt Mode passthrough — appears as a native `DP-*` connector, driven directly by the host GPU

The DP Alt Mode output requires a USB-C port on the host that supports DP Alt Mode. Not all USB-C ports do, even if they have USB4/Thunderbolt controllers. If a monitor gets no signal on dock output 1 but works on outputs 2/3, it's likely on the DP Alt Mode passthrough with a USB-C port that doesn't carry a DisplayPort signal.

**Diagnosis:**
- `hyprctl monitors` — check which connectors are active
- `ls -la /sys/class/drm/ | grep card` — see which cards are EVDI vs native GPU
- `lsusb | grep -i displaylink` — verify dock is recognized
- `systemctl status displaylink.service` — check daemon is running

## Workspace Binding for Multi-Monitor

Assign workspace numbers to specific monitors in `~/.config/hypr/monitors.conf`:

```
workspace = 1, monitor:DVI-I-3, default:true, persistent:true
workspace = 2, monitor:DVI-I-3, persistent:true
workspace = 3, monitor:DVI-I-4, default:true, persistent:true
```

- `default:true` — default workspace shown on that monitor at startup
- `persistent:true` — workspace always exists even when empty

To move existing workspaces immediately (one-time):
```bash
hyprctl dispatch moveworkspacetomonitor 1 DVI-I-3
```

## Portrait/Rotated Monitors

```
# transform: 0=normal, 1=90°, 2=180°, 3=270°
monitor = DVI-I-3, 2560x1440, 0x0, 1, transform, 1
```

A 2560x1440 monitor in portrait (transform 1) occupies 1440px wide × 2560px tall for positioning.

## Connector Name Changes

Connector names (e.g., `DVI-I-1` → `DVI-I-3`) can change when:
- Switching USB-C ports on the host
- Restarting the DisplayLink service (creates new EVDI devices)

Update `monitors.conf` accordingly when this happens.
