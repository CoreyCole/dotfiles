# Omarchy Manual

**IMPORTANT:** For general "how do I" questions, ALWAYS search the Omarchy manual BEFORE answering. The manual at `https://learn.omacom.io` contains Omarchy-specific guidance that may differ from generic Linux advice.

## When to Search the Manual

**Always search first** when users ask:
- "How do I..." / "What is..." / "Why does..." questions
- Questions about installing/running software (Windows, games, apps)
- Questions about concepts, workflows, or best practices
- Topics where Omarchy may have a specific approach

## Searching the Manual

Use Brave LLM Context API with Goggles to scope results to the Omarchy docs:

```bash
curl -s "https://api.search.brave.com/res/v1/llm/context" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: ${BRAVE_SEARCH_API_KEY}" \
  -G \
  --data-urlencode "q=<search terms>" \
  --data-urlencode 'goggles=$discard
$site=learn.omacom.io'
```

This returns pre-extracted page content (text, tables, code) directly — no need for a separate WebFetch.

**Examples:**
- "How do I set up my fingerprint reader?" → `q=fingerprint setup`
- "How do I install Windows on Omarchy?" → `q=install windows vm`
- "How do I install Steam?" → `q=install steam gaming`

## Manual Topic Index

Use keywords from this index to form better search queries:

| Topic | Keywords |
|-------|----------|
| Welcome / Overview | what is omarchy, introduction, about |
| Getting Started | install, installation, setup, ISO, new user |
| Navigation | tiling, workspaces, move, resize, focus, window management |
| Themes | theme, appearance, colors, look, style |
| Extra Themes | community themes, more themes, additional themes |
| Making Themes | create theme, custom theme, theme development |
| Hotkeys | keybindings, shortcuts, keyboard, hotkey reference |
| PDFs | pdf, forms, documents, xournal |
| Applications | apps, software, included, default apps |
| Neovim | neovim, nvim, vim, editor |
| Shell Tools | fzf, zoxide, ripgrep, rg, search |
| Shell Functions | compress, format, convert, shell utilities |
| TUIs | lazygit, lazydocker, btop, terminal ui |
| GUIs | obsidian, pinta, localsend, graphical apps |
| Commercial GUIs | 1password, typora, paid apps |
| Development Tools | dev, programming, coding, ide |
| Web Apps | web app, pwa, browser apps |
| Configuration | config, customize, settings |
| Dotfiles | dotfiles, .config, config files |
| Other Packages | pacman, yay, aur, arch packages |
| FAQ | faq, questions, common issues |
| Updates | update, upgrade, system update |
| Gaming | games, steam, retroarch, gaming |
| Troubleshooting | problem, issue, fix, broken, not working |
| Backgrounds | wallpaper, background, custom wallpaper |
| Security | encryption, firewall, security, luks |
| Fonts | font, typeface, typography |
| Prompt | starship, prompt, terminal prompt |
| Manual Installation | manual install, arch install, step by step |
| Mac Support | mac, macbook, intel mac, apple |
| Windows VM | windows, run windows, install windows, vm, virtual machine, microsoft |
| System Snapshots | snapshot, backup, restore, timeshift |
| Common Tweaks | tweak, customize, adjust, modify |
| Input Devices | keyboard, mouse, trackpad, touchpad, input |
| Fingerprint / Fido2 | fingerprint, fido, yubikey, biometric |
| Monitors | monitor, display, screen, resolution, scaling |
| Running Omarchy | vm, virtualbox, vmware, platforms |
