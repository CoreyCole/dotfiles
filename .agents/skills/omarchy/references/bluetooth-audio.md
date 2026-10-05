# Bluetooth Audio on Omarchy

Omarchy uses PipeWire + WirePlumber for audio and BlueZ for Bluetooth. The practical control surface is `wpctl`/`pactl`, plus Omarchy launch helpers.

Point-in-time Bose QC graph snapshot (paused for kernel 7.2.3 reboot): [`bluetooth-qc-findings-2026-09-17.md`](bluetooth-qc-findings-2026-09-17.md).

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

## Graph tracing (Helvum / wpctl / pw-dump)

Helvum is the visual PipeWire patchbay. It is not installed by default on this Omarchy box. The CLI equivalent is:

```bash
wpctl status
wpctl inspect <id>
pw-dump          # nodes, ports, links, EnumFormat/Format
pw-top -b -n 3   # running rates, quantum, xruns (ERR column)
pw-metadata -n settings
journalctl -u bluetooth --since '1 hour ago'
```

Walk every node on the path from app stream → link → sink. Compare `node.rate` / `Format.rate` / `clock.rate`, channel maps, `pulse.corked`, and link `state`. A healthy A2DP music path looks like:

- app stream `F32LE 2ch 48000`, link `active`, not corked
- sink `api.bluez5.profile=a2dp-sink`, `codec=aac` (or sbc_xq), `S16LE 2ch 48000`
- `pw-top` ERR=0

Incompatible or leftover graph pieces that actually show up here:

1. **SCO loopback while A2DP is active.** With `bluetooth.autoswitch-to-headset-profile=true`, WirePlumber always creates `bluez_input.<addr>` + `bluez_capture_internal.<addr>` (`bluez5.loopback=true`, mono, `resample.disable=true`). The internal capture targets `bluez_input.<addr_underscores>.0`, which only exists in HSP/HFP. In A2DP that target is missing, so the loopback sits suspended/dangling. Any app that records from the fake Bose source flips the card to headset mode.
1. **`a2dp_source` auto-connect on headphones.** `~/.config/wireplumber/wireplumber.conf.d/bluetooth-a2dp-autoconnect.conf` sets `bluez5.auto-connect = [ a2dp_sink a2dp_source ]`. Headphones are an A2DP *sink*. Forcing `a2dp_source` makes bluetoothd log `a2dp-source profile connect failed ... Device or resource busy` and can leave the graph needing a reconnect.
1. **Restored mono stream props.** WirePlumber `node.stream.restore-props=true` persists Slack output as `channelMap: ["MONO"]` after an HFP session. Slack then plays call-quality mono into the A2DP stereo sink. Check `~/.local/state/wireplumber/stream-properties`.
1. **Corked streams with links in `init`.** `node.stream.restore-target=true` plus no dummy/null sink is the VLC-class bug: the app bound to whichever sink existed at start. Changing the default does not always wake it. `pulse.corked=true` and link `state=init` / `format=None` are the tell. A dummy/null sink as the app target, with PipeWire routing the dummy to the real device, sidesteps this.
1. **Clock mismatch.** Graph `clock.allowed-rates = [ 48000 ]` while some browser streams are `44100` (Zen FigJam). PipeWire resamples those as long as `resample.disable` is false on the *stream*. The Bose A2DP node itself only enumerates 48000, so the graph should stay at 48 kHz.

Related:

- Arch Wiki — PipeWire troubleshooting: https://wiki.archlinux.org/title/PipeWire#Troubleshooting
- PipeWire module-loopback / null sink: https://docs.pipewire.org/page_module_loopback.html
