#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE="personal"
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
  *@*)
    REMOTE_USER="${1%@*}"
    REMOTE_HOST="${1#*@}"
    ;;
  *)
    echo "Usage: $0 [ruby|oc|swarm|user@host]"
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

IP=$(run_tailscale ip -4 "$REMOTE_HOST" 2>/dev/null || true)

if [ -z "$IP" ]; then
  echo "Could not find '$REMOTE_HOST' on the personal tailnet."
  echo "Available nodes:"
  run_tailscale status
  exit 1
fi

SSH_TERM="${SSH_TERM:-xterm-256color}"
SSH_LOGIN_TERM="${SSH_LOGIN_TERM:-xterm-256color}"
SSH_LANG="${SSH_LANG:-${LANG:-en_US.UTF-8}}"
SSH_LC_CTYPE="${SSH_LC_CTYPE:-${LC_CTYPE:-$SSH_LANG}}"

case "$SSH_TERM" in
  ""|*[!A-Za-z0-9_.-]*)
    echo "Invalid SSH_TERM: $SSH_TERM"
    exit 1
    ;;
esac

case "$SSH_LOGIN_TERM" in
  ""|*[!A-Za-z0-9_.-]*)
    echo "Invalid SSH_LOGIN_TERM: $SSH_LOGIN_TERM"
    exit 1
    ;;
esac

case "$SSH_LANG:$SSH_LC_CTYPE" in
  *[!A-Za-z0-9_.:@-]*)
    echo "Invalid SSH_LANG or SSH_LC_CTYPE: $SSH_LANG / $SSH_LC_CTYPE"
    exit 1
    ;;
esac

if [ "$SSH_LOGIN_TERM" != "$SSH_TERM" ]; then
  echo "Connecting to $REMOTE_USER@$REMOTE_HOST ($IP) via SOCKS5 proxy with login TERM=$SSH_LOGIN_TERM, shell TERM=$SSH_TERM, locale=$SSH_LC_CTYPE..."
else
  echo "Connecting to $REMOTE_USER@$REMOTE_HOST ($IP) via SOCKS5 proxy with TERM=$SSH_TERM, locale=$SSH_LC_CTYPE..."
fi

export TERM="$SSH_LOGIN_TERM"
exec ssh -t \
  -o ProxyCommand="socat - SOCKS5-CONNECT:127.0.0.1:$SOCKS_PORT:%h:%p" \
  "$REMOTE_USER@$IP" \
  "export TERM=$SSH_TERM LANG=$SSH_LANG LC_CTYPE=$SSH_LC_CTYPE; exec \"\${SHELL:-/bin/zsh}\" -l"
