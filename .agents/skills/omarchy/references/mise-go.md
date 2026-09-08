# Go toolchain via mise (not Nix)

On this Omarchy machine, Chestnut Go tools live in global mise, not Nix.

- Config: `~/.config/mise/config.toml` → `~/dotfiles/.config/mise/config.toml`
- Docs: [mise getting started](https://mise.jdx.dev/getting-started.html), [mise Go](https://mise.jdx.dev/lang/go.html)
- Omarchy helper: `omarchy-install-dev-env go` runs `mise use --global go@latest`. **Do not use it here.** Chestnut is on Go 1.25 (`go.mod` + `chestnut-flake/flake.nix`). `go@latest` is 1.27.

## Pins that must match Chestnut

| Tool | Why |
|---|---|
| `go = "1.25"` | monorepo `go 1.25.7`; flake avoided newer Go on Linux |
| `golangci-lint = "2.4.0"` | Chestnut justfiles/hooks install exactly this |
| `buf`, `mockery`, `sqlc`, `sqruff`, `protoc-gen-connect-openapi` | `monorepo/tools.versions` (CI reads the same file) |
| `templ = 0.3.1020`, `ifacemaker = 1.3.0` | chestnut-flake pins |

After changing tools, run:

```bash
mise install -y
cd ~/cn/chestnut-flake/monorepo && ./scripts/check-tool-versions.sh
```

zsh needs `eval "$(mise activate zsh)"` in `~/.zshrc`. Omarchy only activates mise for bash. See [dev-env-zsh.md](dev-env-zsh.md).
