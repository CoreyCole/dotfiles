# Bose QC PipeWire graph findings (2026-09-17)

Paused before any WirePlumber edits. Re-trace after the pending kernel reboot, then decide.

Related:

- Skill reference (how to check / switch profiles): [`bluetooth-audio.md`](bluetooth-audio.md)
- Quattro is a **separate** one-way upgrade: [`quattro-migration.md`](quattro-migration.md)
- Arch Wiki — [Headset via PipeWire](https://wiki.archlinux.org/title/Bluetooth_headset#Headset_via_PipeWire)
- Arch Wiki — [Disable WirePlumber auto-switching](https://wiki.archlinux.org/title/Bluetooth_headset#Disable_WirePlumber_auto-switching)

## Why this is parked

| Layer | At capture | After next reboot (expected) |
|---|---|---|
| Omarchy | **3.8.5** | still 3.8.5 unless `omarchy-upgrade-to-quattro` is run |
| Running kernel | `7.1.4-arch1-1` | `7.2.3-arch1-3` (already installed 2026-09-17 10:05 PDT) |
| PipeWire / WirePlumber / BlueZ | 1.6.8 / 0.5.17 / 5.87 | same userspace unless packages change |

This reboot is a **kernel swap**, not Quattro. Do not mix a full Quattro migration into it.

Kernel `btusb` / firmware can change Bluetooth timing and reconnect behavior. Userspace leftovers below survive reboot. Changing WirePlumber now would mix two variables.

## Host / device

- Machine: Omarchy on Arch, user `coreycole`
- Headphones: **Bose QC Headphones** `68:F2:1F:46:79:7B`
- Card: `bluez_card.68_F2_1F_46_79_7B`
- Sink: `bluez_output.68_F2_1F_46_79_7B.1`
- Default source: NexiGo webcam mic (not Bose)
- Helvum was **not installed**; graph walked with `wpctl`, `pw-dump`, `pw-top`

Node ids below were from that session. They are not stable. Re-discover with `wpctl status`.

## What was healthy

Playback path at capture:

```
Chromium  F32LE 2ch 48000  quantum 1024  corked=false
    → links state=active
Bose QC   S16LE 2ch 48000  api.bluez5.profile=a2dp-sink  codec=aac
    pw-top ERR=0
```

- Active card profile: `a2dp-sink` (High Fidelity Playback, AAC)
- Also advertised: `a2dp-sink-sbc`, `a2dp-sink-sbc_xq`, `headset-head-unit` (mSBC), `headset-head-unit-cvsd`
- Graph clock: `clock.rate=48000`, `clock.allowed-rates=[ 48000 ]`, quantum 1024 (min 32, max 2048)
- Bose `EnumFormat` is **only** 48000 S16LE stereo — A2DP cannot do 44100 natively
- Default mic was the webcam, so nothing was currently forcing HFP
- Bose does not advertise aptX/LDAC; AAC 48 kHz 16-bit is the best this headset offered

Poor quality is **not** “stuck in headset mode” on the live sink.

## Graph leftovers (likely the real bugs)

### 1. Dangling SCO loopback while A2DP is active

WirePlumber group `loopback-1517-22` existed even on A2DP:

| name | class | problem |
|---|---|---|
| `bluez_input.68:F2:1F:46:79:7B` | Audio/Source | fake Bose mic; MONO; `resample.disable=true`; no rate in EnumFormat |
| `bluez_capture_internal.68:F2:1F:46:79:7B` | Stream/Input/Audio/Internal | `target.object=bluez_input.68_F2_1F_46_79_7B.0` — that node only exists in HSP/HFP |

No link from the capture-internal node to a real source. Suspended / dangling.

Cause: `bluetooth.autoswitch-to-headset-profile = true`. WirePlumber always shows a Bose microphone. The first app that records from it flips the card to `headset-head-unit` (mono ~16 kHz).

### 2. Headphones asked to be an A2DP source

File (survives reboot):

`~/.config/wireplumber/wireplumber.conf.d/bluetooth-a2dp-autoconnect.conf`

```text
bluez5.auto-connect = [ a2dp_sink a2dp_source ]
```

Headphones are an A2DP **sink**. `a2dp_source` is the other direction. bluetoothd at 10:35:

```text
a2dp-source profile connect failed for 68:F2:1F:46:79:7B: Device or resource busy
```

BlueZ `MultiProfile` is still `off`. Classic BR/EDR cannot hold sink + source together. This matches “no audio until disconnect/reconnect.”

SPA device still showed `bluez5.profile = "off"` while the card active profile was `a2dp-sink`.

### 3. Restored Slack / Zen channel maps

`~/.local/state/wireplumber/stream-properties` (survives reboot):

```text
Output/Audio:application.name:Slack  channelMap=["MONO"]
Input/Audio:application.name:Slack   channelVolumes=[3.375, 3.375]
Input/Audio:application.name:Zen     channelMap=["MONO"]
```

`node.stream.restore-props=true`. Slack last looked like HFP, so later Slack playback can be mono into the stereo A2DP sink.

### 4. Corked apps with `init` links — no dummy sink

Zen had two streams linked to Bose, both `pulse.corked=true`, links `state=init` / `format=None`:

- YouTube trailer: 48000 (paused)
- FigJam: **44100** on a 48000-only graph

`node.stream.restore-target=true`. No null/dummy audio sink; only PipeWire `Dummy-Driver` (clock). Apps bind to the real Bose node. If that node dies on reconnect, the app stays silent until restart. A dummy sink as the app target, with PipeWire routing to Bose, is the structural fix.

## Files that will still be there after reboot

Do not edit until the graph is re-traced on kernel 7.2.3:

- `~/.config/wireplumber/wireplumber.conf.d/bluetooth-a2dp-autoconnect.conf`
- `~/.local/state/wireplumber/stream-properties`
- `~/.local/state/wireplumber/default-routes` (Bose profile already saved as `a2dp-sink`)
- WirePlumber setting `bluetooth.autoswitch-to-headset-profile=true`

## Resume after reboot

1. Confirm kernel: `uname -r` should be `7.2.3-arch1-3`. Confirm Omarchy: `omarchy-version` (still 3.8.5 unless Quattro was actually run).
1. Connect Bose QC. Play something in Chromium or `paplay`.
1. Re-walk the graph:

```bash
wpctl status
wpctl inspect @DEFAULT_AUDIO_SINK@ | grep -E 'bluez5.profile|bluez5.codec|node.name'
pw-top -b -n 3
pw-metadata -n settings
journalctl -u bluetooth --since '10 min ago'
```

4. Compare against this snapshot:

   - Is the sink still `a2dp-sink` / AAC / 2ch 48000?
   - Do `bluez_input.*` + `bluez_capture_internal.*` still exist while A2DP is active?
   - Does bluetoothd still log `a2dp-source profile connect failed`?
   - Is Slack still saved as `channelMap=["MONO"]`?
   - Any corked streams with link `state=init`?

1. Only then apply userspace fixes, one at a time, if the leftovers remain.

## Proposed fixes (not applied)

Explain before running. Restart WirePlumber after config edits.

1. Drop `a2dp_source` from the auto-connect rule. Headphones only need `a2dp_sink`.
1. `wpctl settings --save bluetooth.autoswitch-to-headset-profile false` so the fake Bose mic/loopback goes away.
1. Clear Slack/Zen mono maps in `stream-properties` (or remove that file and restart WirePlumber).
1. Optional later: null/dummy sink as the stable app target; Bose behind it.
1. Optional later: install `helvum` or `qpwgraph` for a visual patchbay.

Start with 1–3. Do not change kernel, firmware, and WirePlumber in the same window.

## Mental model

PipeWire is a graph, not a device picker. BlueZ creates the hardware node. WirePlumber then adds loopbacks, restored props, and auto-connect. Poor Bluetooth audio here was extra paths / restored props, not “the sink isn’t A2DP.”
