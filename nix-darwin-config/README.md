# nix-darwin config

This directory is the active macOS host configuration.

## Responsibility split

Use three layers, each for a different kind of state:

- `flake.nix` / nix-darwin: machine and system-level macOS config
- `home.nix` / Home Manager: Corey user-level config
- Homebrew: GUI apps, casks, and macOS tools that are better installed through Brew

## nix-darwin: machine config

Keep host/system concerns in `flake.nix`:

- Nix inputs and overlays
- `environment.systemPackages` for system-wide CLI tools
- nix-daemon / Determinate Nix setup
- `system.primaryUser`
- host platform
- system services such as Tailscale
- macOS security/settings such as Touch ID sudo
- Homebrew taps, casks, and formulas
- per-machine overrides for named Darwin configurations

## Home Manager: user config

When Home Manager is added, put user account concerns in `home.nix`:

- shell config and aliases
- Git config
- Direnv config
- user packages
- `home.sessionVariables`
- dotfiles via `home.file`
- XDG config via `xdg.configFile`
- user-scoped program config under `programs.*`

Most user config should be shared across all Macs. Do not introduce machine-specific user modules until there is a concrete difference that needs it.

## Homebrew

Use Homebrew for:

- GUI applications and casks
- vendor-distributed macOS apps
- packages that work better from Brew than nixpkgs on macOS
- dependencies explicitly documented as Brew installs, such as some local conversion tools

Example: `imagemagick` and `ghostscript` are installed through Homebrew for pi-docparser/LiteParse image/vector conversion support.

LibreOffice is also useful for Office document conversion paths, but it is intentionally not managed here while the current Homebrew casks are broken on this machine:

- `libreoffice` currently reports incompatible macOS metadata
- `libreoffice-still` currently fails cask evaluation with `wrong number of arguments`

If needed, install LibreOffice manually from <https://www.libreoffice.org/download/>. The app bundle includes the CLI at:

```text
/Applications/LibreOffice.app/Contents/MacOS/soffice
```

The tracked root `.zshrc` adds `/Applications/LibreOffice.app/Contents/MacOS` to `PATH` on Darwin when that directory exists.

## Why keep `home.nix` separate?

A separate `home.nix` does not add capability over inline Home Manager config. It keeps the mental model clean:

```text
flake.nix  = this Mac / system
home.nix   = Corey's user environment
```

This avoids turning `flake.nix` into one large mixed file and makes it easy for all Darwin hosts to share the same user configuration.

## Relationship to `../nixos-config/`

`../nixos-config/` is the older broader NixOS/WSL/VM-oriented configuration. It already contains a Home Manager example under `users/coreycole/home-manager.nix`.

For current macOS host work, treat this directory as the source of truth. Use `../nixos-config/` as reference only unless intentionally reviving or merging that setup.

## Validate

`nix flake check --no-build` is only a lightweight flake output evaluation check. It can miss errors that happen while evaluating the full Darwin system derivation.

Use both checks before applying changes:

```bash
# 1. Fast flake output sanity check
nix flake check ./nix-darwin-config --no-build

# 2. Full Darwin system evaluation/build plan for the active host
nix build ./nix-darwin-config#darwinConfigurations.Coreys-MacBook-Pro.config.system.build.toplevel --dry-run
```

For the other configured hosts, change the Darwin configuration name:

```bash
nix build ./nix-darwin-config#darwinConfigurations.Coreys-MacBook-Pro-2.config.system.build.toplevel --dry-run
nix build ./nix-darwin-config#darwinConfigurations.swarms-MacBook-Pro.config.system.build.toplevel --dry-run
```

If the flake references new local files, add them to git before validating or switching. Flakes cannot see untracked files.

```bash
git add nix-darwin-config/new-file
```

Apply after validation:

```bash
sudo darwin-rebuild switch --flake ~/dotfiles/nix-darwin-config
```
