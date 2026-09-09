# Herdr Config Notes

This directory is the source of truth for Herdr config:

- Tracked file: `~/dotfiles/.config/herdr/config.toml`
- Live path: `~/.config/herdr/config.toml` (file-level symlink)

Do not symlink the whole `~/.config/herdr/` directory. That directory also holds runtime files: sockets, logs, `session.json`, and `.plugins.lock`.

## Official docs

Do not guess config keys. Look them up here:

- Config reference: https://herdr.dev/docs/config-reference/
- Configuration guide: https://herdr.dev/docs/configuration/

Print the installed defaults and validate the live file:

```bash
herdr --default-config
herdr config check
```

`HERDR_CONFIG_PATH` overrides the config file path.

## Local intent

Keep these local choices unless the user asks to change them:

- Use the default prefix (`ctrl+b`).
- Do not nest Herdr inside tmux.
- `onboarding = false`
- `switch_tab` includes both `prefix+1..9` and `alt+1..9`
- Compact pane chrome: no pane gaps, no outer borders, no scrollbars
- Agent status uses `symbols`
- Toasts use system delivery

## After you edit config.toml

1. Validate:

   ```bash
   herdr config check
   ```

1. Reload the running server:

   ```bash
   herdr server reload-config
   ```

   You can also use `prefix+shift+r`.

Reload applies most UI keys without restarting panes. Startup-only keys still need a restart.

## Logs

Runtime logs live next to the live config, not in this directory:

- `~/.config/herdr/herdr-client.log`
- `~/.config/herdr/herdr-server.log`
