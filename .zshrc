export GPG_TTY=$(tty)
# export TERM=screen-256color
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

if [[ "$OSTYPE" == darwin* && -d "/Applications/LibreOffice.app/Contents/MacOS" ]]; then
  export PATH="/Applications/LibreOffice.app/Contents/MacOS:$PATH"
fi
# DB_LOCAL_CONNECT_STR="host=localhost port=15432 user=premium dbname=premium sslmode=disable"
# DB_L_CONNECT_STR="host=localhost port=15432 user=premium dbname=premium sslmode=disable"

source "$HOME/dotfiles/.zsh_aliases"

export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
DISABLE_AUTO_TITLE="true"
zstyle ':omz:update' mode disabled
plugins=(git sudo extract fzf zsh-autosuggestions zsh-completions zsh-syntax-highlighting)
source $ZSH/oh-my-zsh.sh
export EDITOR=nvim
export VISUAL=nvim

# pnpm
if [[ "$OSTYPE" == darwin* ]]; then
  export PNPM_HOME="$HOME/Library/pnpm"
else
  export PNPM_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/pnpm"
fi
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac
# pnpm end

# fnm Homebrew, needed if fnm comes from brew
if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# fnm
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --use-on-cd --shell zsh)"
fi

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

export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"

# opencode
export PATH="$HOME/.opencode/bin:$PATH"

# SSH into tailnet machines via docker
home() { "$HOME/dotfiles/tailscale-docker/ssh-home.sh" "${1:-ruby}"; }
work() { "$HOME/dotfiles/tailscale-docker/ssh-work.sh" "${1:-default}"; }

# Switch local Tailscale profile/tailnet
alias switch-home='tailscale switch ccoreycole@gmail.com'
alias switch-work='tailscale switch chestnutfi.com'

alias pr="gt branch info --no-interactive | grep -Eo 'https://app\.graphite\.com/[^[:space:]]+' | head -1"

export PATH="$HOME/go/bin:$HOME/.npm-global/bin:$PATH"

if command -v chestnut >/dev/null 2>&1; then
  eval "$(chestnut shell-init zsh)"
fi

# suppress the benign macOS warning tracked by NousResearch/hermes-agent#54833
hermes() {
  "$HOME/.local/bin/hermes" "$@" \
    2> >(grep --line-buffered -Fv \
      "MallocStackLogging: can't turn off malloc stack logging because it was not enabled." >&2)
}

# Omarchy's mise activate lives in bash init only. zsh needs this or you get
# shims without the real install dirs on PATH.
# https://mise.jdx.dev/getting-started.html
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate zsh)"
fi
