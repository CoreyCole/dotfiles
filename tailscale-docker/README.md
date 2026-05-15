# tailscale-docker

Run two isolated Tailscale clients in Docker so this machine can SSH into both:

- your **personal** tailnet
- your **work** tailnet

Each container exposes a local SOCKS5 proxy, and the helper scripts SSH through that proxy using `socat`.

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
work          # coreycole@coreys-macbook-pro-2-2
work swarm    # swarm@swarms-macbook-pro-1
work user@host
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
