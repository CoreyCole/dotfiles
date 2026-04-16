export GPG_TTY=$(tty)
export TERM=screen-256color
export XDG_CONFIG_HOME="$HOME/.config"

# load machine-local secrets from an untracked file
if [[ -f "$HOME/dotfiles/secrets.sh" ]]; then
  source "$HOME/dotfiles/secrets.sh"
fi

export PATH="$HOME/dotfiles/cctl/bin:$PATH"
export PATH="$HOME/cn/chestnut-flake/monorepo/.claude/bin:$PATH"
export PATH="/run/current-system/sw/bin:$PATH"
export PATH="$HOME/.nix-profile/bin:$PATH"
export PATH="$HOME/.nvim/bin:$PATH"
# DB_LOCAL_CONNECT_STR="host=localhost port=15432 user=premium dbname=premium sslmode=disable"
# DB_L_CONNECT_STR="host=localhost port=15432 user=premium dbname=premium sslmode=disable"
alias cn="$HOME/dotfiles/setup-tmux.sh"

alias dev="cd $HOME/cn/chestnut-flake/monorepo && git stash && gt sync && git checkout develop; cd db; just migrate up; cd ..; just migrate"
alias j="just"
alias push="cd $HOME/cn/chestnut-flake/monorepo && bash hooks/pre-push"
alias submit="gt submit --stack"
alias yolo="gt submit --stack --no-verify"
alias sync="cd $HOME/cn/chestnut-flake/monorepo && gt sync && cd db; just migrate up; cd .."
alias cld="claude --dangerously-skip-permissions"


export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
plugins=(git sudo extract fzf zsh-autosuggestions zsh-completions zsh-syntax-highlighting)
source $ZSH/oh-my-zsh.sh
export EDITOR=nvim
export VISUAL=nvim

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# fnm
eval "$(fnm env)"

export GOPROXY=https://proxy.golang.org,direct

#compdef gt
###-begin-gt-completions-###
#
# yargs command completion script
#
# Installation: gt completion >> ~/.zshrc
#    or gt completion >> ~/.zprofile on OSX.
#
_gt_yargs_completions()
{
  local reply
  local si=$IFS
  IFS=$'\n' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" gt --get-yargs-completions "${words[@]}"))
  IFS=$si
  _describe 'values' reply
}
compdef _gt_yargs_completions gt
###-end-gt-completions-###


# turbo repo no track
export TURBO_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1

# [ -s "${HOME}/.g/env" ] && \. "${HOME}/.g/env"  # g shell setup - commented out to avoid conflict with Nix go
# Explicitly unset GOROOT to use Nix Go instead of .g
unset GOROOT
unset GOCACHE

source <(fzf --zsh)

export DIRENV_LOG_FORMAT=""
export NIX_CONFIG="warn-dirty = false"
export NIX_DIRENV_SILENT=0

eval "$(direnv hook zsh)"

export PATH="$HOME/.local/bin:$PATH"

# opencode
export PATH="$HOME/.opencode/bin:$PATH"

# SSH into personal tailnet machines via docker
home() { "$HOME/dotfiles/tailscale-docker/ssh-home.sh" "${1:-ruby}"; }
export PATH="$HOME/go/bin:$PATH"
