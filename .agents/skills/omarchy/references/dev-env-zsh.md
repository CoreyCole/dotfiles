# Development Environment with Zsh

Omarchy's default shell is bash. The mise activation (`eval "$(mise activate bash)"`) is configured in `~/.local/share/omarchy/default/bash/init`, which only runs for bash users.

## Zsh Users: mise Activation Required

If you use zsh (e.g., Oh My Zsh), mise will **not** be activated automatically. It falls back to **shims mode** (`~/.local/share/mise/shims` on PATH), which handles mise-managed tools like `node` and `npm` themselves, but does **not** add the actual install directories (e.g., `~/.local/share/mise/installs/node/<version>/bin/`) to PATH.

This means globally installed npm packages (`npm install -g`) won't be found because their binaries live in the node install directory, not in the shims.

### Fix

Add mise activation to `~/.zshrc`:

```zsh
# mise
eval "$(mise activate zsh)"
```

This makes mise dynamically manage PATH for all its tools, including globally installed npm/node binaries.

### Do NOT use npm prefix workaround

Do not use `npm config set prefix ~/.npm-global` as a workaround. With mise activation, the node install directory is on PATH and global npm installs work natively.

## Installing Dev Environments

Omarchy provides `omarchy-install-dev-env <language>` for setting up development environments via mise. Supported: ruby, node, bun, deno, go, php, laravel, symfony, python, elixir, phoenix, rust, java, zig, ocaml, dotnet, clojure, scala.

Example: `omarchy-install-dev-env node` runs `mise use --global node`.
