# Compose Key and Accented Characters

## Hyprland configuration

Assign a Compose key through XKB options in `~/.config/hypr/input.conf`:

```ini
input {
  kb_layout = us
  kb_options = caps:escape,compose:ralt
}
```

Hyprland reloads the configuration when the file changes. Confirm the effective value with:

```bash
hyprctl getoption input:kb_options
```

Common Compose sequences with Right Alt as Compose:

| Sequence | Result |
|---|---|
| `Right Alt`, `'`, `e` | `é` |
| `Right Alt`, `` ` ``, `a` | `à` |
| `Right Alt`, `~`, `n` | `ñ` |
| `Right Alt`, `"`, `u` | `ü` |
| `Right Alt`, `,`, `c` | `ç` |

Press and release Compose before entering the remaining keys. The sequence is not a chord.

## Choosing another Compose key

List installed Compose options with:

```bash
localectl list-x11-keymap-options | grep '^compose:'
```

Common alternatives include `compose:menu`, `compose:rwin`, and `compose:caps`. Do not use `compose:caps` when Caps Lock is already assigned with `caps:escape`.

## fcitx5 interaction

Omarchy runs fcitx5. Its keyboard addon should have `UseNewComposeBehavior=True` in `~/.config/fcitx5/conf/keyboard.conf`. The XKB `compose:*` option still assigns the physical Compose key.

## Sources

- [Arch Wiki: Configuring the Compose key](https://wiki.archlinux.org/title/Xorg/Keyboard_configuration#Configuring_compose_key)
- [Hyprland: input variables](https://wiki.hypr.land/Configuring/Variables/#input)
- [XKB configuration options](https://man.archlinux.org/man/xkeyboard-config.7)
