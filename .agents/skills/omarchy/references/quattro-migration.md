# Omarchy 3 to Quattro migration

Omarchy v4.0.0 (Quattro) is a one-way system migration, not a normal config refresh. The official release instructs existing installations to run the normal Omarchy update first, then the dedicated **Omarchy to Quattro** upgrade.

Sources:

- [Omarchy v4.0.0 release](https://github.com/basecamp/omarchy/releases/tag/v4.0.0)
- [Upgrade implementation](https://github.com/basecamp/omarchy/blob/v4.0.0/bin/omarchy-upgrade-to-quattro)
- [Quattro dotfiles manual](https://github.com/basecamp/omarchy/blob/v4.0.0/manual/31-dotfiles.md)
- [Quattro file layout](https://github.com/basecamp/omarchy/blob/v4.0.0/docs/file-layout.md)

## What changes

- Core moves from a user Git checkout to packages under `/usr/share/omarchy`.
- Hyprland user entry points become Lua: `hyprland.lua`, `bindings.lua`, `monitors.lua`, `input.lua`, `looknfeel.lua`, and `autostart.lua`.
- One Quickshell process replaces Waybar, Walker, Mako, SwayOSD, hyprlock, hypridle, and related panel processes.
- `~/.config/omarchy/shell.json` owns bar layout and idle timing.
- `~/.config/omarchy/shell.toml` overrides shell appearance and dimensions.
- Generated current theme state moves to `~/.local/state/omarchy/current/`.
- NetworkManager replaces iwd on upgraded systems.

## Dotfile-manager hazard

The upgrader intentionally writes new files under `~/.config/hypr`, rewrites UWSM state, and moves retired UI directories such as `~/.config/waybar` and `~/.config/walker` to timestamped backups. If those directories are symlinks into a dotfiles repository, the migration can write into or remove tracked source unexpectedly.

Before upgrading:

1. Make the dotfiles repository clean.
2. Inventory all live config symlinks.
3. Archive dereferenced copies of upgrade-touched config.
4. Replace upgrade-touched whole-directory symlinks with ordinary live copies.
5. Run the upgrader against those live copies.
6. After a successful first Quattro boot, port intent into tracked Lua/shell files and restore only reviewed Quattro symlinks.

Do not relink retired Waybar, Walker, Mako, hypridle, or hyprlock directories after migration.

## Snapshot warning

Legacy `omarchy-snapshot create` only creates snapshots for names returned by `snapper list-configs`. Having Btrfs and the `snapper` binary installed does not mean a snapshot exists. If no Snapper configurations are listed, the command can print its heading and create nothing.

Before the one-way upgrade, require:

- a dereferenced file archive of user configuration and migration manifests; and
- verified root/home Btrfs recovery snapshots or another independently restorable system backup.

List and read files from the recovery artifacts before proceeding. Do not rely only on the upgrade command's snapshot attempt.

## Safe sequence

1. Normal Omarchy 3 update to receive current upgrade tooling.
2. Dedicated stable Quattro upgrade **without automatic reboot**.
3. Stop if the upgrader reports a partial transition, boot-command-line warning, package failure, or missing config.
4. Inspect generated config, package state, and boot artifacts.
5. Reboot only after pre-reboot checks pass.
6. Verify the generated Quattro desktop before activating converted tracked customizations.
7. Verify again after restoring reviewed dotfile links.
