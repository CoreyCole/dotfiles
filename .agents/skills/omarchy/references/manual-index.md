# Omarchy Manual

**IMPORTANT:** For general "how do I" questions, ALWAYS search the Omarchy manual BEFORE answering. The manual at `https://learn.omacom.io` contains Omarchy-specific guidance that may differ from generic Linux advice.

## When to Search the Manual

**Always search first** when users ask:
- "How do I..." / "What is..." / "Why does..." questions
- Questions about installing/running software (Windows, games, apps)
- Questions about concepts, workflows, or best practices
- Topics where Omarchy may have a specific approach

## Searching for Answers

Search **both** Omarchy docs and the Arch Wiki. Omarchy is built on Arch, so many answers live in the Arch Wiki even if there's no Omarchy-specific page.

### Step 1: Search for relevant pages

Search Omarchy docs first, then Arch Wiki:

```bash
# Search Omarchy docs
curl -s "https://api.search.brave.com/res/v1/llm/context" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: ${BRAVE_SEARCH_API_KEY}" \
  -G \
  --data-urlencode "q=<search terms>" \
  --data-urlencode 'goggles=$discard
$site=learn.omacom.io'

# Search Arch Wiki
curl -s "https://api.search.brave.com/res/v1/llm/context" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: ${BRAVE_SEARCH_API_KEY}" \
  -G \
  --data-urlencode "q=<search terms>" \
  --data-urlencode 'goggles=$discard
$site=wiki.archlinux.org'
```

These return snippets and URLs. Use them to identify the right article(s).

### Step 2: Get Arch Wiki section index

For Arch Wiki articles, fetch the table of contents to find relevant sections without loading the full page:

```bash
curl -s "https://wiki.archlinux.org/api.php?action=parse&page=<Page_Title>&prop=sections&format=json" \
  | python3 -c "
import json, sys
for s in json.load(sys.stdin)['parse']['sections']:
    indent = '  ' * (int(s['toclevel']) - 1)
    print(f\"{s['index']:>3}. {indent}{s['line']}\")
"
```

Replace spaces with underscores in the page title.

### Step 3: Fetch specific sections

Fetch only the sections you need by index number:

```bash
curl -s "https://wiki.archlinux.org/api.php?action=parse&page=<Page_Title>&prop=wikitext&section=<N>&format=json" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['parse']['wikitext']['*'])"
```

**Note:** Do NOT use WebFetch for the Arch Wiki — it is blocked by Cloudflare/Anubis. The MediaWiki API above bypasses this reliably. WebFetch is fine for Omarchy docs (`learn.omacom.io`).

**Examples:**
- "How do I set up my fingerprint reader?" → `q=fingerprint setup`
- "How do I install Windows on Omarchy?" → `q=install windows vm`
- "How do I install Steam?" → `q=install steam gaming`
- "fcitx5 keybinding config" → search Arch Wiki (not in Omarchy docs)

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
| DisplayLink | displaylink, dock, evdi, usb display, dvi, multi-monitor dock |
| Running Omarchy | vm, virtualbox, vmware, platforms |
