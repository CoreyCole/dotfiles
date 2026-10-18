#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE="work"
SSH_SCRIPT="$COMPOSE_DIR/ssh-work.sh"
README="$COMPOSE_DIR/README.md"

cd "$COMPOSE_DIR"

docker_cmd() {
  if [[ -w /var/run/docker.sock ]]; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

run_tailscale() {
  docker_cmd compose exec -T "$SERVICE" tailscale "$@"
}

if ! docker_cmd compose ps --status running --services | grep -qx "$SERVICE"; then
  echo "Starting $SERVICE tailscale container..."
  docker_cmd compose up -d "$SERVICE"
fi

HOSTNAME="$(
  run_tailscale status \
    | awk '
        tolower($2) ~ /^corey/ && $4 == "macOS" && tolower($0) !~ /offline/ { print tolower($2) }
      ' \
    | sort
)"

COUNT="$(printf '%s\n' "$HOSTNAME" | sed '/^$/d' | wc -l | tr -d ' ')"

case "$COUNT" in
  0)
    echo "Could not find an online macOS work-tailnet host starting with 'corey'."
    echo "Available matching nodes:"
    run_tailscale status | awk 'tolower($2) ~ /^corey/ { print }'
    exit 1
    ;;
  1)
    ;;
  *)
    echo "Found multiple online macOS work-tailnet hosts starting with 'corey':"
    printf '%s\n' "$HOSTNAME"
    echo "Refusing to guess. Update ssh-work.sh manually or make the matcher more specific."
    exit 1
    ;;
esac

perl -0pi -e 's/REMOTE_HOST="corey[^"]*"/REMOTE_HOST="'"$HOSTNAME"'"/i' "$SSH_SCRIPT"
perl -0pi -e 's/work           # coreycole\@corey[^\n]*/work           # coreycole\@'"$HOSTNAME"'/i' "$README"

echo "Updated work hostname to $HOSTNAME"
