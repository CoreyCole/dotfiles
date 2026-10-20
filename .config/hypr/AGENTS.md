# Hyprland config

This directory owns the user Hyprland config. Do not edit `/usr/share/omarchy/` to change this behavior.

## Caps Lock reset plugin

The plugin source is `plugins/caps-lock-reset/main.cpp`.
It provides `hl.plugin.caps_lock_reset.clear()`.
The plugin is not connected to `bindings.lua` and does not load automatically.

A native plugin runs inside the compositor. A defect can terminate the desktop session.
Do not load the plugin, add startup loading, or change the live game-mode hook without explicit user approval.

Preserve these requirements:

- Clear Caps Lock on every keyboard, including inactive keyboards.
- Preserve Num Lock, other modifiers, and the keyboard layout.
- Restore the original seat keyboard after modifier events.
- Never use an unconditional Caps Lock toggle.
- Finish any pending keyboard-map refresh before the reset.
- Keep compiled binaries outside Git.

Hyprland 0.56.2 preserves locked modifiers during keymap changes when `numlock_by_default` is true.
Restoring `caps:escape` alone does not clear Caps Lock.

## Symbol visibility and the previous crash

The first plugin build used `-fvisibility=hidden`.
Hyprland declares `g_pSeatManager` and `g_pInputManager` as inline globals.
Hidden visibility created private, null copies inside the plugin.
The reset dereferenced a null manager and crashed the compositor.
Automatic startup calls repeated the crash after login.

The crash dump showed null plugin managers and initialized compositor managers.
The faulting instruction matched the offline rebuild at offset `0x252e`.

Keep `-fvisibility=default` in the build command.
Do not remove the symbol-address checks in `PLUGIN_INIT`.
Those checks compare plugin manager addresses with symbols from the running compositor.
The ABI hash alone does not detect incorrect symbol binding.
Keep the null-manager guard in the reset callback.

## Build and upgrade

The build requires a C++23 compiler, `pkg-config`, and development headers for Hyprland, Lua, and XKB.
Use the same compiler as the installed Hyprland build.
If the default compiler differs, set `CXX` explicitly.

Run:

```bash
bash ~/.config/hypr/scripts/build-caps-lock-reset.sh
```

The script writes `${XDG_CACHE_HOME:-$HOME/.cache}/hypr/caps-lock-reset.so`.
It does not load the plugin or reload Hyprland.
It replaces the binary atomically rather than overwriting a loaded file.

After a Hyprland upgrade, rebuild the plugin against the installed headers.
Do not bypass an ABI mismatch or a symbol-address mismatch.
If an old plugin is already loaded, save your work and restart the session after the rebuild.
A config reload does not replace an already-loaded shared library.

## Manual activation

Only after explicit approval, load the plugin:

```bash
hyprctl plugin load "${XDG_CACHE_HOME:-$HOME/.cache}/hypr/caps-lock-reset.so"
```

Loading the plugin does not clear Caps Lock or connect it to game mode.
The reset requires a separate call:

```bash
hyprctl eval 'hl.plugin.caps_lock_reset.clear()'
```

Do not add automatic startup calls before the user approves the game-mode integration.
Do not describe a successful build as proof that live activation is safe.

## References

- [Hyprland plugin API and ABI checks](https://github.com/hyprwm/Hyprland/blob/v0.56.2/src/plugins/PluginAPI.hpp)
- [Seat manager global](https://github.com/hyprwm/Hyprland/blob/v0.56.2/src/managers/SeatManager.hpp)
- [Input manager global](https://github.com/hyprwm/Hyprland/blob/v0.56.2/src/managers/input/InputManager.hpp)
- [Keyboard modifier handling](https://github.com/hyprwm/Hyprland/blob/v0.56.2/src/devices/IKeyboard.cpp)
