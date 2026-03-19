---
name: arch
description: Use when working on an Arch Linux system — resolving pacman/yay errors (conflicting files, locked database, failed transactions), managing packages (pacman, yay, AUR), configuring Hyprland/Wayland, troubleshooting PipeWire audio, managing btrfs snapshots with snapper, systemd services, Limine bootloader, kernel issues, or any Arch-specific system administration.
references:
  - references/package-management.md
  - references/systemd.md
  - references/hyprland.md
  - references/audio.md
  - references/storage.md
  - references/boot-kernel.md
  - references/network.md
  - references/maintenance.md
  - references/virtualization.md
---

# Arch Linux System Skill

Guidance for Arch Linux system administration tailored to this system's stack:
**Hyprland (Wayland) + Limine + Btrfs/Snapper + PipeWire + yay + zsh**

Authority: Official Arch Wiki (https://wiki.archlinux.org/)

## Behavior

Be an educational guide, not an executor. The user is learning Arch and wants to understand their system deeply.

1. **Research autonomously** — read reference files, search the Arch Wiki, inspect system state (read-only commands like `systemctl status`, `journalctl`, `ip link`, `pacman -Q`, etc.) without asking permission.
2. **Explain before acting** — before running any command that modifies the system (`sudo`, `pacman -S`, `systemctl restart`, editing config files, etc.), stop and explain:
   - What the command does and why it's the right fix
   - What it will change on the system
   - Any risks or side effects
   - Link to the relevant Arch Wiki section when possible
3. **Summarize findings** — after researching, present a clear summary: what you found, what the problem is, what the options are. Teach the "why" not just the "what".
4. **Wait for confirmation** — only execute modifying commands or edits after the user says to proceed.
5. **Cite sources** — reference Arch Wiki pages, man pages, or upstream docs so the user can read further.
6. **Grow the skill** — when research uncovers useful information not already in the reference files (new troubleshooting steps, config patterns, wiki findings), suggest adding it as a new reference document or updating an existing one in `references/`. This keeps the skill improving over time.

## Searching the Arch Wiki

Research tool — use freely during the autonomous research phase. For questions not covered in this skill, use Brave LLM Context API with Goggles to search the Arch Wiki:

```bash
curl -s "https://api.search.brave.com/res/v1/llm/context" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: ${BRAVE_SEARCH_API_KEY}" \
  -G \
  --data-urlencode "q=<search terms>" \
  --data-urlencode 'goggles=$discard
$site=wiki.archlinux.org'
```

This returns pre-extracted page content (text, tables, code) directly — no need for a separate WebFetch.

## System Hardware

| Component | Details |
|-----------|---------|
| Machine | AZW SER mini PC |
| CPU | AMD Ryzen 7 255 (Zen 4, 8C/16T) |
| GPU | AMD Radeon 780M (RDNA3 integrated, HawkPoint1) |
| RAM | 64 GB DDR5 |
| Storage | 1 TB NVMe (nvme0n1) |
| Monitor | Dell U2717D — 2560x1440@60Hz via HDMI-A-1, portrait rotation (transform: 1) |
| Network | Ethernet (eno1) + Wi-Fi (wlan0) |

## Disk Layout

```
nvme0n1 (931.5G)
├─ nvme0n1p1  2G    vfat         /boot (ESP)
└─ nvme0n1p2  929.5G crypto_LUKS
   └─ root    929.5G btrfs       (LUKS encrypted)
      ├─ @       → /
      ├─ @home   → /home
      ├─ @log    → /var/log
      └─ @pkg    → /var/cache/pacman/pkg
```

Btrfs options: `compress=zstd:3,ssd,space_cache=v2`

## Key Software Versions

| Package | Version |
|---------|---------|
| Kernel | linux 6.19.8.arch1-1 |
| Hyprland | 0.54.2 |
| Waybar | 0.15.0 |
| PipeWire | 1.6.2 |
| WirePlumber | 0.5.13 |
| Mesa | 26.0.2 |
| Vulkan (radeon) | 26.0.2 |
| Limine | 10.8.5 |
| Snapper | 0.13.0 |
| yay | 12.5.7 |
| zsh | 5.9 |
| Starship | 1.24.2 |
| Alacritty | 0.16.1 |

## GPU (AMD RDNA3 Integrated)

Open-source Mesa/RADV stack — no proprietary driver needed:
- `mesa` — OpenGL/Vulkan (radeonsi/RADV)
- `vulkan-radeon` — Vulkan ICD
- `linux-firmware-amdgpu` — firmware blobs
- `libdrm` — Direct Rendering Manager

```bash
# Check GPU driver in use
lspci -k | grep -A 2 VGA

# Verify Vulkan
vulkaninfo --summary

# Monitor GPU usage
cat /sys/class/drm/card*/device/gpu_busy_percent
```
