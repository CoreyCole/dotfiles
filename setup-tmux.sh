#!/usr/bin/env bash
# Tmux session setup script for chestnut-flake development

SESSION_NAME="$(whoami)"
FLAKE_DIR="$HOME/cn/chestnut-flake"
MONOREPO_DIR="$FLAKE_DIR/monorepo"
MONOREPO2_DIR="$FLAKE_DIR/monorepo2"
MONOREPO3_DIR="$FLAKE_DIR/monorepo3"
CN_AGENTS_DIR="$FLAKE_DIR/cn-agents"

# Check if session already exists
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? == 0 ]; then
    echo "Session '$SESSION_NAME' already exists."
    # Check if we're already in a tmux session
    if [ -n "$TMUX" ]; then
        echo "Switching to session '$SESSION_NAME'..."
        tmux switch-client -t $SESSION_NAME
    else
        echo "Attaching to session '$SESSION_NAME'..."
        tmux attach-session -t $SESSION_NAME
    fi
    exit 0
fi

# Create new session with actual terminal size to preserve pane proportions
# Window 0 is created automatically by new-session at CN_AGENTS_DIR
tmux new-session -d -s $SESSION_NAME -c "$CN_AGENTS_DIR" -x "$(tput cols)" -y "$(tput lines)"

# Window 0: 4 left panes + 3 right panes (dashboard)
# Left: cn-agents, monorepo (just up), monorepo2, monorepo3
# Right: monorepo (empty), monorepo (api logs), monorepo (worker logs)
PANE_CN_AGENTS=$(tmux display-message -t "$SESSION_NAME:0" -p '#{pane_id}')

# Create right column
PANE_R1=$(tmux split-window -t "$PANE_CN_AGENTS" -h -p 50 -c "$MONOREPO_DIR" -P -F '#{pane_id}')

# Split left column: 3 more panes below cn-agents
PANE_L2=$(tmux split-window -t "$PANE_CN_AGENTS" -v -p 75 -c "$MONOREPO_DIR" -P -F '#{pane_id}')
PANE_L3=$(tmux split-window -t "$PANE_L2" -v -p 67 -c "$MONOREPO2_DIR" -P -F '#{pane_id}')
PANE_L4=$(tmux split-window -t "$PANE_L3" -v -p 50 -c "$MONOREPO3_DIR" -P -F '#{pane_id}')
# Left: PANE_CN_AGENTS (25%), PANE_L2 (25%), PANE_L3 (25%), PANE_L4 (25%)

# Split right column: 2 more panes below top
PANE_R2=$(tmux split-window -t "$PANE_R1" -v -p 67 -c "$MONOREPO_DIR" -P -F '#{pane_id}')
PANE_R3=$(tmux split-window -t "$PANE_R2" -v -p 50 -c "$MONOREPO_DIR" -P -F '#{pane_id}')
# Right: PANE_R1 (33%), PANE_R2 (33%), PANE_R3 (33%)

# Select top-left pane
tmux select-pane -t "$PANE_CN_AGENTS"

create_lazygit_window() {
    local window="$1"
    local dir="$2"

    tmux new-window -t "$SESSION_NAME:$window" -c "$dir"
    local left_pane
    left_pane=$(tmux display-message -t "$SESSION_NAME:$window" -p '#{pane_id}')
    tmux split-window -t "$left_pane" -h -p 50 -c "$dir"
    tmux send-keys -t "$left_pane" "lazygit" C-m
    tmux select-pane -t "$left_pane"
}

# Windows 1-3: the three main monorepo checkouts, with lazygit on the left
# and an empty terminal on the right.
create_lazygit_window 1 "$MONOREPO_DIR"
create_lazygit_window 2 "$MONOREPO2_DIR"
create_lazygit_window 3 "$MONOREPO3_DIR"

# Windows 4-8: chestnut-flake terminals.
for window in 4 5 6 7 8; do
    tmux new-window -t "$SESSION_NAME:$window" -c "$FLAKE_DIR"
done

# Window 9: dotfiles, with lazygit on the left and an empty terminal on the right.
create_lazygit_window 9 "$HOME/dotfiles"

# Select window 1 to start
tmux select-window -t $SESSION_NAME:1

# Send startup script to 2nd left pane (monorepo) - runs just up
tmux send-keys -t "$PANE_L2" "$(
    cat <<EOF
# Ensure OrbStack is running
if ! pgrep -q "OrbStack"; then
  echo "Starting OrbStack..."
  open -a OrbStack
fi

# Wait for Docker to be ready
echo "Waiting for Docker to be ready..."
TIMEOUT=30
ELAPSED=0
until docker info >/dev/null 2>&1 || [ \$ELAPSED -ge \$TIMEOUT ]; do
  sleep 1
  ELAPSED=\$((ELAPSED + 1))
done

if [ \$ELAPSED -ge \$TIMEOUT ]; then
  echo "Warning: Docker did not become ready within \${TIMEOUT} seconds"
else
  echo "Docker is ready! Starting services..."
  just up

  # After just up completes, start the log commands in right panes
  tmux send-keys -t $PANE_R2 "just logs api" C-m
  tmux send-keys -t $PANE_R3 "just logs worker" C-m
fi
EOF
)" C-m

# Attach to the session immediately
tmux attach-session -t $SESSION_NAME
