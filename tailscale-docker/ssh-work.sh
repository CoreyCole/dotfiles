#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE="work"
HOSTNAME="mac-docker-work"
SOCKS_PORT=1056
TARGET="${1:-default}"

case "$TARGET" in
  default)
    REMOTE_USER="coreycole"
    REMOTE_HOST="coreys-macbook-pro-2-2"
    ;;
  swarm)
    REMOTE_USER="swarm"
    REMOTE_HOST="swarms-macbook-pro-1"
    ;;
  *@*)
    REMOTE_USER="${TARGET%@*}"
    REMOTE_HOST="${TARGET#*@}"
    ;;
  *)
    echo "Usage: $0 [swarm|user@host]"
    exit 1
    ;;
esac

cd "$COMPOSE_DIR"

run_tailscale() {
  docker compose exec -T "$SERVICE" tailscale "$@"
}

ensure_running() {
  if ! docker compose ps --status running --services | grep -qx "$SERVICE"; then
    echo "Starting $SERVICE tailscale container..."
    docker compose up -d "$SERVICE"

    echo "Waiting for tailscale to come up..."
    for _ in $(seq 1 30); do
      if run_tailscale version >/dev/null 2>&1; then
        return 0
      fi
      sleep 1
    done

    echo "Timed out waiting for tailscale to start."
    exit 1
  fi
}

ensure_logged_in() {
  local status
  status=$(run_tailscale status 2>&1 || true)

  if echo "$status" | grep -q "Logged out"; then
    echo "$status"
    echo
    echo "Open the login URL above, complete login, then press Enter to continue."
    read -r _

    for _ in $(seq 1 60); do
      status=$(run_tailscale status 2>&1 || true)
      if ! echo "$status" | grep -q "Logged out"; then
        return 0
      fi
      sleep 1
    done

    echo "Still not logged in. Try again after completing the browser login."
    exit 1
  fi
}

ensure_running
ensure_logged_in

HEALTH=$(run_tailscale status 2>&1 | grep "$HOSTNAME" || true)
if echo "$HEALTH" | grep -q "offline"; then
  echo "Tailscale connection stale, restarting $SERVICE container..."
  docker compose restart "$SERVICE" >/dev/null
  sleep 5
fi

IP=$(run_tailscale ip -4 "$REMOTE_HOST" 2>/dev/null || true)

if [ -z "$IP" ]; then
  echo "Could not find '$REMOTE_HOST' on the work tailnet."
  echo "Available nodes:"
  run_tailscale status
  exit 1
fi

echo "Connecting to $REMOTE_USER@$REMOTE_HOST ($IP) via SOCKS5 proxy..."
exec ssh -o ProxyCommand="socat - SOCKS5-CONNECT:127.0.0.1:$SOCKS_PORT:%h:%p" "$REMOTE_USER@$IP"
