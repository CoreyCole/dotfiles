# App launcher entries

Omarchy does not have a separate app registry. The Apps overlay reads standard XDG desktop entries and launches them inside the session.

## What opens the list

On this machine (packaged bindings in `/usr/share/omarchy/default/hypr/bindings/utilities.lua`):

| Keys | What it opens |
|---|---|
| Super+Alt+Space | Apps (`omarchy-shell omarchy.dock apps`) |
| Super+Space | Omarchy menu (`omarchy menu`) |

The [Omarchy 3 Navigation page](https://learn.omacom.io/2/the-omarchy-manual/51/install-apps) swaps those two keys. Trust the binding file, not that page, after the Quattro-era shell.

`omarchy install app` only installs an Arch package name. It does not register a folder you already downloaded.

## How an app gets in

`/usr/share/omarchy/shell/services/AppLibrary.qml` lists `DesktopEntries.applications` and starts an entry with:

```
uwsm-app -- gtk-launch <id>.desktop
```

A file in `~/.local/share/applications/<id>.desktop` is enough. `omarchy-refresh-applications` only copies Omarchy's own desktop files into that directory. It does not delete a name it does not own. Do not put the file under `/usr/share/omarchy/`.

Hidden, `NoDisplay=true`, `OnlyShowIn`, and `NotShowIn` drop an entry. See `/usr/share/omarchy/shell/services/hidden-entries.sh`.

Pin a visible entry with `omarchy dock pin <id>` (no `.desktop` suffix).

## Antigravity IDE: use the AUR, not the tarball

There is no official Arch or Omarchy package. The update channel is the AUR package [`antigravity-ide`](https://aur.archlinux.org/packages/antigravity-ide). It unpacks Google's tarball to `/opt/antigravity-ide`, installs `/usr/bin/antigravity-ide`, and ships `antigravity-ide.desktop`. It does not compile the IDE.

Do not install AUR package `antigravity`. That is Antigravity 2.0, a different product.

Omarchy menu: Install > AUR, then type `antigravity-ide`. On this machine the menu is Super+Space. The [Other Packages](https://learn.omacom.io/2/the-omarchy-manual/66/other-packages) page still says Super+Alt+Space. CLI equivalent: `omarchy-pkg-aur-add antigravity-ide` (`yay -S`). `omarchy pkg add` and Install > Package search official repos only and will not find it.

`omarchy-update` already runs `omarchy-update-aur-pkgs` (`yay -Sua`) after the system upgrade. A foreign package such as `grok-bot-bin` is enough for that step to run. See [Updates](https://learn.omacom.io/2/the-omarchy-manual/68/updates).

The AUR can lag Google. On 2026-11-23 the package was 2.7.0-1, flagged out of date on 2026-11-21, while the Downloads tarball was `ideVersion` 2.8.0. Installing the package then is a downgrade until the maintainer bumps it. The tarball's `updateUrl` is `https://example.com`, so the unpacked tree will not update itself.

## Portable Electron tree

Use this only when the AUR package is behind a tarball you need to keep. A Google-style tarball (`Antigravity IDE/`, VS Code layout) is not installed just because it sits in `~/Downloads`. Move the tree to a path with no spaces, then add a desktop file.

User layout that matches the AUR desktop entry without root:

- tree: `~/.local/opt/antigravity-ide/`
- command: `~/.local/bin/antigravity-ide` → `../opt/antigravity-ide/bin/antigravity-ide`
- icon: `resources/app/resources/linux/code.png` copied to `~/.local/share/icons/hicolor/256x256/apps/antigravity-ide.png`
- entry: `~/.local/share/applications/antigravity-ide.desktop`

```ini
[Desktop Entry]
Name=Antigravity IDE
Comment=Experience liftoff
GenericName=Text Editor
Exec=antigravity-ide %F
Icon=antigravity-ide
Type=Application
StartupNotify=false
StartupWMClass=antigravity-ide
Categories=TextEditor;Development;IDE;
```

Then:

```bash
gtk-update-icon-cache ~/.local/share/icons/hicolor
update-desktop-database ~/.local/share/applications
```

`StartupWMClass` must match `applicationName` in `product.json` (`antigravity-ide`). That is the Hyprland window class.

The bundled `chrome-sandbox` setuid bit does nothing while the file is owned by the user. This machine has `kernel.unprivileged_userns_clone=1`, so the Electron sandbox does not need a root-owned helper. Do not `chmod 4755` it as the user.

Launch from a terminal with `uwsm-app -- antigravity-ide` so it inherits the Wayland session. A bare `./antigravity-ide` from an SSH shell will not.
