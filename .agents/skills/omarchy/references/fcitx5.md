# fcitx5 (Input Method Framework)

Omarchy ships fcitx5 as the input method framework. It runs as a background service and intercepts keystrokes globally.

## Config Location

```
~/.config/fcitx5/
├── profile                    # Input method groups/layouts
└── conf/
    ├── keyboard.conf          # Keyboard addon: spell hints, completion, candidates
    ├── clipboard.conf         # Clipboard manager (Omarchy clears TriggerKey/PastePrimaryKey)
    ├── xcb.conf               # XCB settings
    └── notifications.conf     # Notification preferences
```

Omarchy core files (DO NOT EDIT):
```
~/.local/share/omarchy/config/environment.d/fcitx.conf    # Sets INPUT_METHOD, QT_IM_MODULE, etc.
~/.local/share/omarchy/config/fcitx5/conf/clipboard.conf  # Disables clipboard hotkeys
~/.local/share/omarchy/config/fcitx5/conf/xcb.conf        # XCB overrides
```

## Default Keybindings (keyboard addon)

| Keybinding | Function | Config Key |
|---|---|---|
| `Control+Alt+H` | Toggle spell hint mode (persistent) | `Hint Trigger` |
| `Control+Alt+J` | Spell hint one-time trigger | `One Time Hint Trigger` |

These are compiled defaults in `/usr/bin/fcitx5`. "Completion" in the notification refers to spell hint/word prediction from the dictionary.

## Rebinding or Disabling Keys

**Critical:** fcitx5 config has two formats for key lists — flat keys and section-based. For `List|Key` type options, **only the section format works** and **flat keys override sections**. A flat `Hint Trigger=` will clear the value even if a `[Hint Trigger]` section exists below.

### Correct format (sections only, no flat key lines):

```ini
PageSize=5
EnableEmoji=True
EnableQuickPhraseEmoji=True
Choose Modifier=Alt
EnableHintByDefault=False
UseNewComposeBehavior=True
EnableLongPress=False

[PrevCandidate]
0=Shift+Tab

[NextCandidate]
0=Tab

[Hint Trigger]
0=Control+Alt+apostrophe

[One Time Hint Trigger]
0=Control+Alt+apostrophe

[LongPressBlocklist]
0=konsole
1=org.kde.konsole
```

### To disable a key, use an empty section:

```ini
[Hint Trigger]

[One Time Hint Trigger]
```

### Key names

fcitx5 uses XKB keysym names. Letters are uppercase (`H`, `J`, `K`). Punctuation uses XKB names like `apostrophe`, `semicolon`, etc.

## Restarting

**`fcitx5-remote -r` does NOT reliably reload keybinding changes.** You must do a full restart:

```bash
killall fcitx5; sleep 1; fcitx5 --disable notificationitem -d
```

## Verifying Config

Query runtime config via dbus:

```bash
busctl --user call org.fcitx.Fcitx5 /controller \
  org.fcitx.Fcitx.Controller1 GetConfig s "fcitx://config/addon/keyboard"
```

**Warning:** `SetConfig` via dbus writes flat keys which clear list values. Do not use dbus to set `List|Key` options — edit the config file directly instead.

## Gotchas

- The dbus `SetConfig` method and `fcitx5-remote -r` both overwrite `keyboard.conf` with flat keys, clearing your section-based bindings. Always edit the file directly and do a full restart.
- fcitx5 grabs keys globally before Hyprland sees them. If a key combo does nothing in Hyprland, check fcitx5 first.
- Omarchy hides all fcitx5 desktop entries (`~/.local/share/omarchy/applications/hidden/fcitx5-*.desktop`), so it won't appear in app launchers.
