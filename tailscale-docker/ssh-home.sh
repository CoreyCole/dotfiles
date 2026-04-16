#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTAINER="tailscale-docker-tailscale-1"
SOCKS_PORT=1055

# resolve target from argument
case "${1:-ruby}" in
  ruby)
    REMOTE_USER="ruby"
    REMOTE_HOST="ruby"
    ;;
  oc|claude)
    REMOTE_USER="claude"
    REMOTE_HOST="claude-1"
    ;;
  swarm)
    REMOTE_USER="coreycole"
    REMOTE_HOST="swarm"
    ;;
  *)
    echo "Usage: $0 [ruby|oc|swarm]"
    exit 1
    ;;
esac

cd "$COMPOSE_DIR"

# start container if not running
if ! docker compose ps --status running --quiet 2>/dev/null | grep -q .; then
  echo "Starting tailscale container..."
  docker compose up -d

  echo "Waiting for tailscale to come up..."
  for i in $(seq 1 30); do
    if docker exec "$CONTAINER" tailscale status &>/dev/null; then
      break
    fi
    sleep 1
  done
  sleep 2
fi

# check if tailscale is healthy, restart if stale
HEALTH=$(docker exec "$CONTAINER" tailscale status 2>&1 | grep "mac-docker-personal" || true)
if echo "$HEALTH" | grep -q "offline"; then
  echo "Tailscale connection stale, restarting container..."
  docker compose restart >/dev/null 2>&1
  sleep 5
fi

# resolve hostname to tailscale IP
IP=$(docker exec "$CONTAINER" tailscale ip -4 "$REMOTE_HOST" 2>/dev/null || true)

if [ -z "$IP" ]; then
  echo "Could not find '$REMOTE_HOST' on the personal tailnet."
  echo "Available nodes:"
  docker exec "$CONTAINER" tailscale status
  exit 1
fi

echo "Connecting to $REMOTE_USER@$REMOTE_HOST ($IP) via SOCKS5 proxy..."
exec ssh -o ProxyCommand="nc -X 5 -x 127.0.0.1:$SOCKS_PORT %h %p" "$REMOTE_USER@$IP"
