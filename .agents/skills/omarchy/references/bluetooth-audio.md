# Bluetooth Audio on Omarchy

Omarchy uses PipeWire + WirePlumber for audio and BlueZ for Bluetooth. The practical control surface is `wpctl`/`pactl`, plus Omarchy launch helpers.

Sources:
- Arch Wiki — Bluetooth headset via PipeWire: https://wiki.archlinux.org/title/Bluetooth_headset#Headset_via_PipeWire
- Arch Wiki — A2DP sink unavailable: https://wiki.archlinux.org/title/Bluetooth_headset#A2DP_sink_profile_is_unavailable
- Arch Wiki — Disable WirePlumber auto-switching: https://wiki.archlinux.org/title/Bluetooth_headset#Disable_WirePlumber_auto-switching
- Arch Wiki — PipeWire Bluetooth devices: https://wiki.archlinux.org/title/PipeWire#Bluetooth_devices

## Vital commands

```bash
# See devices, sinks, current default, and active app streams
wpctl status

# Set a PipeWire sink as the default for new audio
wpctl set-default <sink-id>

# See stable PulseAudio-compatible sink names and app stream ids
pactl list sinks short
pactl list sink-inputs short

# Set a stable sink name as default and move existing app streams
pactl set-default-sink <sink-name>
for i in $(pactl list sink-inputs short | awk '{print $1}'); do
  pactl move-sink-input "$i" <sink-name>
done
```

## Omarchy shortcuts

Omarchy includes:

```bash
omarchy-launch-audio      # opens wiremix TUI
omarchy-launch-bluetooth  # opens bluetui TUI
omarchy-cmd-audio-switch  # cycles available output sinks
```

Default Hyprland bindings in Omarchy core:

- `SUPER + CTRL + A` opens audio controls (`wiremix`)
- `SUPER + CTRL + B` opens Bluetooth controls (`bluetui`)
- `SUPER + XF86AudioMute` cycles audio outputs

Do not edit Omarchy core files under `~/.local/share/omarchy/`; user overrides belong in `~/.config/`.

## Headset vs A2DP

Bluetooth headphones usually expose two modes:

- **A2DP**: high-quality playback, usually output only.
- **HSP/HFP / headset-head-unit**: call mode, usually mono/lower bandwidth output plus microphone.

Check the actual negotiated mode with:

```bash
pactl list sinks | grep -A60 'bluez_output'
pactl list cards | grep -A45 'bluez_card'
```

Look for:

- `api.bluez5.profile = "a2dp-sink"` or a stereo sample spec for high-quality playback.
- `api.bluez5.profile = "headset-head-unit"`, `Channel Map: mono`, and `16000Hz` for headset/call mode.

On at least one Bose QC setup, audio routed correctly and sounded acceptable even while PipeWire reported `headset-head-unit`, `msbc`, `s16le 1ch 16000Hz`. Do not assume sound quality from the label alone; verify both what PipeWire reports and what the user hears.

If `pactl list cards` shows only `headset-head-unit` profiles and no `a2dp` profile, PipeWire cannot switch the headphones to high-quality music mode yet. The Arch Wiki suggests trying reconnect via `bluetoothctl`, pressing play/pause on the headset, restarting Bluetooth, enabling BlueZ `MultiProfile=multiple`, or disabling the headset profile depending on the device.

WirePlumber may automatically switch to headset mode when an app opens the Bluetooth microphone. To disable that behavior:

```bash
wpctl settings --save bluetooth.autoswitch-to-headset-profile false
```

This changes WirePlumber user settings and should be explained before running.
