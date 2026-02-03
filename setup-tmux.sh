#!/usr/bin/env bash
# Tmux session setup script for chestnut-flake development

SESSION_NAME="cn"
FLAKE_DIR="$HOME/cn/chestnut-flake"
MONOREPO_DIR="$FLAKE_DIR/monorepo"
MONOREPO2_DIR="$FLAKE_DIR/monorepo2"
MONOREPO3_DIR="$FLAKE_DIR/monorepo3"
CN_AGENTS_DIR="$FLAKE_DIR/cn-agents"
DATASTARUI_DIR="$CN_AGENTS_DIR/pkg/datastarui"

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
tmux new-session -d -s $SESSION_NAME -c "$FLAKE_DIR" -x "$(tput cols)" -y "$(tput lines)"

# Window 1: monorepo with nvim
tmux new-window -t $SESSION_NAME:1 -c "$MONOREPO_DIR"
tmux send-keys -t $SESSION_NAME:1 "nvim" C-m

# Window 2: 4 left panes + 3 right panes
# Left: cn-agents, monorepo, monorepo2, monorepo3
# Right: monorepo (just up), monorepo (api logs), monorepo (worker logs)
tmux new-window -t $SESSION_NAME:2 -c "$MONOREPO_DIR"

# Create cn-agents pane on the LEFT using -b flag
tmux split-window -t $SESSION_NAME:2.0 -h -b -p 50 -c "$CN_AGENTS_DIR"
# After -b split: pane 0 = monorepo (right), pane 1 = cn-agents (left)

# Split left column (pane 1, cn-agents) into 4 panes
tmux split-window -t $SESSION_NAME:2.1 -v -p 75 -c "$MONOREPO_DIR"
# Pane 1: cn-agents (top 25%), pane 2: monorepo (bottom 75%)
tmux split-window -t $SESSION_NAME:2.2 -v -p 67 -c "$MONOREPO2_DIR"
# Pane 2: monorepo (top), pane 3: monorepo2 (bottom 67%)
tmux split-window -t $SESSION_NAME:2.3 -v -p 50 -c "$MONOREPO3_DIR"
# Pane 3: monorepo2 (top), pane 4: monorepo3 (bottom 50%)
# Left column: 1 (cn-agents), 2 (monorepo), 3 (monorepo2), 4 (monorepo3)

# Split right column (pane 0, monorepo) into 3 panes
tmux split-window -t $SESSION_NAME:2.0 -v -p 67 -c "$MONOREPO_DIR"
# Pane 0: monorepo (top 33%), pane 5: monorepo (bottom 67%)
tmux split-window -t $SESSION_NAME:2.5 -v -p 50 -c "$MONOREPO_DIR"
# Right column: 0 (top), 5 (middle), 6 (bottom) - all monorepo

# Select top-right pane (monorepo)
tmux select-pane -t $SESSION_NAME:2.0

# Window 3: monorepo with dbee
tmux new-window -t $SESSION_NAME:3 -c "$MONOREPO_DIR"
tmux send-keys -t $SESSION_NAME:3 "nvim -c 'lua require(\"dbee\").open()'" C-m

# Window 4: cn-agents with vertical split (left 85%, right 15%)
tmux new-window -t $SESSION_NAME:4 -c "$CN_AGENTS_DIR"

# Create vertical split - right pane gets 15%
tmux split-window -t $SESSION_NAME:4 -h -p 15 -c "$CN_AGENTS_DIR"

# Split the right pane horizontally into 2 equal panes
tmux split-window -t $SESSION_NAME:4.1 -v -c "$DATASTARUI_DIR"

# Send nvim to left pane with fzf file search
tmux send-keys -t $SESSION_NAME:4.0 "nvim -c 'lua require(\"fzf-lua\").files({ cmd = \"fd --type f --hidden --follow --no-ignore --exclude .git --exclude node_modules\" })'" C-m

# Wait for Docker then run just up in the right panes
tmux send-keys -t $SESSION_NAME:4.1 "$(
    cat <<'EOF'
echo "Waiting for Docker..."
until docker info >/dev/null 2>&1; do
  sleep 1
done
echo "Docker ready! Starting cn-agents..."
just up
just logs-follow
EOF
)" C-m

tmux send-keys -t $SESSION_NAME:4.2 "$(
    cat <<'EOF'
echo "Waiting for Docker..."
until docker info >/dev/null 2>&1; do
  sleep 1
done
echo "Docker ready! Starting datastarui..."
just up
docker logs --follow datastarui-local-app-1
EOF
)" C-m

# Focus on nvim pane
tmux select-pane -t $SESSION_NAME:4.0

# Window 5: datastarui with nvim and fzf file search
tmux new-window -t $SESSION_NAME:5 -c "$DATASTARUI_DIR"
tmux send-keys -t $SESSION_NAME:5 "nvim -c 'lua require(\"fzf-lua\").files({ cmd = \"fd --type f --hidden --follow --no-ignore --exclude .git --exclude node_modules\" })'" C-m

# Window 6: monorepo2 with nvim and fzf file search
tmux new-window -t $SESSION_NAME:6 -c "$MONOREPO2_DIR"
tmux send-keys -t $SESSION_NAME:6 "nvim -c 'lua require(\"fzf-lua\").files({ cmd = \"fd --type f --hidden --follow --no-ignore --exclude .git --exclude node_modules\" })'" C-m

# Window 7: chestnut-flake with nvim and fzf file search
tmux new-window -t $SESSION_NAME:7 -c "$FLAKE_DIR"

# Window 8: chestnut-flake with nvim and fzf file search
tmux new-window -t $SESSION_NAME:8 -c "$FLAKE_DIR"

# Window 9: dotfiles with nvim and fzf file search
tmux new-window -t $SESSION_NAME:9 -c "$HOME/dotfiles"
tmux send-keys -t $SESSION_NAME:9 "nvim -c 'lua require(\"fzf-lua\").files({ cmd = \"fd --type f --hidden --follow --no-ignore --exclude .git --exclude node_modules\" })'" C-m

# Select window 1 (nvim) to start
tmux select-window -t $SESSION_NAME:1

# Send startup script to top-right pane of window 2 (monorepo)
tmux send-keys -t $SESSION_NAME:2.0 "$(
    cat <<'EOF'
# Ensure OrbStack is running
if ! pgrep -q "OrbStack"; then
  echo "Starting OrbStack..."
  open -a OrbStack
fi

# Wait for Docker to be ready
echo "Waiting for Docker to be ready..."
TIMEOUT=30
ELAPSED=0
until docker info >/dev/null 2>&1 || [ $ELAPSED -ge $TIMEOUT ]; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "Warning: Docker did not become ready within ${TIMEOUT} seconds"
else
  echo "Docker is ready! Starting services..."
  just up

  # After just up completes, start the log commands in right panes
  # Right column: pane 0 (top, just up), pane 5 (middle, api logs), pane 6 (bottom, worker logs)
  tmux send-keys -t cn:2.5 "just logs api" C-m
  tmux send-keys -t cn:2.6 "just logs worker" C-m
fi
EOF
)" C-m

# Attach to the session immediately
tmux attach-session -t $SESSION_NAME
