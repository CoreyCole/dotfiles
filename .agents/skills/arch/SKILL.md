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

### Pareto Teaching

When explaining any topic, apply the 80/20 rule:

1. **Lead with the vital 20%** — identify the small set of concepts, commands, or mental models that explain the vast majority of real-world behavior. Start there. Don't bury the essentials under exhaustive detail.
   - Example: for pacman, the vital 20% is `pacman -Syu` (sync+upgrade), `-S` (install), `-Rs` (remove with deps), `-Qs` (search installed), `-Ss` (search repos), and understanding that pacman is transactional and resolves deps automatically. That covers ~80% of daily use.
   - Example: for systemd, the vital 20% is `systemctl start/stop/enable/disable/status`, `journalctl -u <unit>`, and understanding that units are declarative descriptions of services with dependency ordering. That covers ~80% of daily use.

2. **Surface common misconceptions** — after teaching the core, proactively call out what people commonly get wrong or misunderstand about that core knowledge. Frame these as "what most people think vs. what's actually true."
   - Example: "A common misconception is that `pacman -Sy <package>` is fine for installing a single package. Actually, partial upgrades (`-Sy` without `-u`) can break your system because the new package may link against newer library versions than what you have installed. Always use `-Syu` or `-S` (which uses the last-synced database)."
   - Example: "People often think `systemctl enable` starts a service. It doesn't — it only creates the symlink so the service starts on next boot. You need `enable --now` to also start it immediately."

3. **Layer depth on request** — after covering the vital 20%, offer to go deeper. Say what the next layer covers so the user can decide if they need it. Don't front-load complexity.

### Cite with Links

When explaining topics, provide section-specific links so the user can read more:

- **Arch Wiki sections:** `https://wiki.archlinux.org/title/<Page_Title>#<Section_Name>` (replace spaces with underscores in section names)
- **Man pages:** `man <command>` or link to `https://man.archlinux.org/man/<command>.<section>`

### Research and Action

1. **Research autonomously** — read reference files, search the Arch Wiki, inspect system state (read-only commands like `systemctl status`, `journalctl`, `ip link`, `pacman -Q`, etc.) without asking permission.
2. **Explain before acting** — before running any command that modifies the system (`sudo`, `pacman -S`, `systemctl restart`, editing config files, etc.), stop and explain:
   - What the command does and why it's the right fix
   - What it will change on the system
   - Any risks or side effects
   - Link to the relevant Arch Wiki section
3. **Summarize findings** — after researching, present a clear summary: what you found, what the problem is, what the options are. Teach the "why" not just the "what".
4. **Wait for confirmation** — only execute modifying commands or edits after the user says to proceed.
5. **Cite sources** — reference Arch Wiki section links, man pages, or upstream docs so the user can read further. Always include clickable links.
6. **Grow the skill** — when research uncovers useful information not already in the reference files (new troubleshooting steps, config patterns, wiki findings):
   - Add a new reference document or update an existing one in `references/`
   - Add a link to the new reference in the `References` section of `SKILL.md`
   - Include links to the relevant Arch Wiki sections and upstream docs *inside* the reference file so future sessions can go straight to the source
   - The goal is to build a knowledge base that accumulates over time — each session should leave the skill better than it found it.

## Searching the Arch Wiki

Research tool — use freely during the autonomous research phase. For questions not covered in this skill, use Brave LLM Context API with Goggles to search the Arch Wiki:

### Step 1: Search for relevant pages

```bash
curl -s "https://api.search.brave.com/res/v1/llm/context" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: ${BRAVE_SEARCH_API_KEY}" \
  -G \
  --data-urlencode "q=<search terms>" \
  --data-urlencode 'goggles=$discard
$site=wiki.archlinux.org'
```

This returns snippets and URLs. Use it to identify the right wiki article(s).

### Step 2: Get section index

Fetch the table of contents to find relevant sections without loading the full page:

```bash
curl -s "https://wiki.archlinux.org/api.php?action=parse&page=<Page_Title>&prop=sections&format=json" \
  | python3 -c "
import json, sys
for s in json.load(sys.stdin)['parse']['sections']:
    indent = '  ' * (int(s['toclevel']) - 1)
    print(f\"{s['index']:>3}. {indent}{s['line']}\")
"
```

Replace spaces with underscores in the page title. For subpages, URL-encode the slash (e.g. `Localization%2FKorean`).

### Step 3: Fetch specific sections

Fetch only the sections you need by index number:

```bash
curl -s "https://wiki.archlinux.org/api.php?action=parse&page=<Page_Title>&prop=wikitext&section=<N>&format=json" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['parse']['wikitext']['*'])"
```

This returns MediaWiki wikitext: `== Section ==` for headers, `{{Pkg|name}}` for packages, `{{ic|code}}` for inline code.

**Note:** Do NOT use WebFetch for the Arch Wiki — it is blocked by Cloudflare/Anubis. The MediaWiki API above bypasses this reliably.

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
