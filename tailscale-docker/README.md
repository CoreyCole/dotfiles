# tailscale-docker

Run two isolated Tailscale clients in Docker so this machine can SSH into both:

- your **personal** tailnet
- your **work** tailnet

Each container exposes a local SOCKS5 proxy, and the helper scripts SSH through that proxy using `socat`. Multiple simultaneous SSH sessions through the same tailnet container are supported.

## Files

- `docker-compose.yml` — starts both Tailscale containers
- `ssh-home.sh` — SSH through the personal tailnet
- `ssh-work.sh` — SSH through the work tailnet

## Services

### personal

- hostname: `mac-docker-personal`
- SOCKS5 proxy: `127.0.0.1:1055`
- helper: `./ssh-home.sh`

### work

- hostname: `mac-docker-work`
- SOCKS5 proxy: `127.0.0.1:1056`
- helper: `./ssh-work.sh`

## Setup

Start the containers:

```bash
cd ~/dotfiles/tailscale-docker
docker compose up -d
```

Log in through the browser when prompted:

```bash
home
work
```

The helper prints a `https://login.tailscale.com/...` URL if that container is logged out. Open it, complete login, then press Enter in the terminal. Docker volumes persist each tailnet login.

## Shell helpers

`.zshrc` defines:

```bash
home
work
```

Reload your shell after updating dotfiles:

```bash
source ~/.zshrc
```

## Usage

### Personal tailnet

```bash
home          # ruby@ruby
home swarm    # coreycole@swarm
home oc       # claude@claude-1
home user@host
```

### Work tailnet

```bash
work           # coreycole@coreys-macbook-pro-2-2
work swarm     # swarm@swarms-macbook-pro-1
work user@host # any other machine on the work tailnet
```

## Troubleshooting

### Show available nodes

```bash
docker compose exec -T personal tailscale status
docker compose exec -T work tailscale status
```

### Host not found

If a helper script says it cannot find the host, verify the exact device name in `tailscale status`.

### Restart one side

```bash
docker compose restart personal
docker compose restart work
```

### Terminal glitches over SSH

If the remote shell prints errors like:

```text
can't find terminal definition for xterm-ghostty
```

or interactive input looks corrupted, the remote login environment does not have terminfo for your local terminal early enough during shell startup. The helper scripts start SSH login with `TERM=xterm-256color`, then switch the interactive shell to your local `TERM` by default, so Ghostty sessions still run as `xterm-ghostty` after nix-darwin's login environment has loaded.

To use Ghostty's terminal type, the remote login environment must have `xterm-ghostty` in one of its active terminfo paths. This dotfiles repo installs `pkgs.ghostty.terminfo` through nix-darwin for macOS machines. After rebuilding nix-darwin on the target, test it with:

```bash
work
infocmp xterm-ghostty
```

To force a safer terminal type for one connection:

```bash
SSH_TERM=xterm-256color work
SSH_TERM=xterm-256color home
```

Inside tmux, this dotfiles config uses `tmux-256color` and updates the tmux server's SSH and locale environment on attach. If glyphs differ only inside an existing tmux session, reload the config and restart the tmux server so panes inherit the new terminal and UTF-8 locale settings:

```bash
tmux source-file ~/.tmux.conf
tmux kill-server
```

Glyph rendering still depends on the font in the terminal you are physically looking at. SSH does not send fonts from the remote machine; it only sends characters. Use the same Nerd Font / symbol-capable font in your local terminal if prompt icons differ.


### Reset Tailscale state

```bash
docker compose down
docker volume rm tailscale-docker_ts-state-personal tailscale-docker_ts-state-work
docker compose up -d
```

## Notes

- No auth key is required; this setup uses browser login via `login.tailscale.com`.
- The host machine itself does not need to join both tailnets directly for this workflow.
- SSH is tunneled through a local SOCKS5 proxy exposed by each Tailscale container.
- `ssh-home.sh` targets the `personal` service.
- `ssh-work.sh` targets the `work` service.
