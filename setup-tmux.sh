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
direnv allow
nix develop --command true # builds the chestnut-flake, then exits
tmux send-keys -t $SESSION_NAME:1 "nvim" C-m

# Window 2: 4 left panes + 3 right panes
# Left: cn-agents, monorepo (just up), monorepo2, monorepo3
# Right: monorepo (empty), monorepo (api logs), monorepo (worker logs)
tmux new-window -t $SESSION_NAME:2 -c "$CN_AGENTS_DIR"
PANE_CN_AGENTS=$(tmux display-message -t "$SESSION_NAME:2" -p '#{pane_id}')

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
