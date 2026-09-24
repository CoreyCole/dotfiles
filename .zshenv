if [[ -f "$HOME/.cargo/env" ]]; then
  . "$HOME/.cargo/env"
fi

# clear stale direnv state (inherited from tmux server) so direnv re-evaluates
unset DIRENV_DIR DIRENV_FILE DIRENV_DIFF DIRENV_WATCHES 2>/dev/null

# nix-darwin prepends $NIX_PROFILES completion dirs that often do not exist.
# compinit then tries to use /nix/var/nix/profiles/default/share/zsh/5.9/functions
# and zsh prints that path with the first 15 characters removed.
typeset -U fpath
fpath=(${^fpath}(N-/))

# Hooks and other non-interactive zsh need the chestnut-flake devshell PATH.
# Interactive shells must not pay for this: direnv's hook loads it on cd.
# A cold `direnv exec` is slow, so reuse a cache until the flake inputs change.
if [[ ! -o interactive && -d "$HOME/cn/chestnut-flake" ]]; then
  _nix_path_cache="$HOME/.cache/chestnut-flake-path"
  _nix_envrc="$HOME/cn/chestnut-flake/.envrc"
  _nix_lock="$HOME/cn/chestnut-flake/flake.lock"
  _nix_path=""
  _nix_cache_fresh=0
  if [[ -f "$_nix_path_cache" && -f "$_nix_envrc" && "$_nix_path_cache" -nt "$_nix_envrc" ]]; then
    if [[ ! -f "$_nix_lock" || "$_nix_path_cache" -nt "$_nix_lock" ]]; then
      _nix_cache_fresh=1
    fi
  fi
  if (( _nix_cache_fresh )); then
    _nix_path="$(<"$_nix_path_cache")"
  else
    _nix_path="$(direnv exec "$HOME/cn/chestnut-flake" bash -c 'echo $PATH' 2>/dev/null)"
    if [[ -n "$_nix_path" ]]; then
      mkdir -p "${_nix_path_cache:h}"
      printf '%s\n' "$_nix_path" >"$_nix_path_cache"
    fi
  fi
  if [[ -n "$_nix_path" ]]; then
    export PATH="$_nix_path"
  fi
  unset _nix_path _nix_path_cache _nix_envrc _nix_lock _nix_cache_fresh
fi

export LANG="${LANG:-en_US.UTF-8}"
export LC_CTYPE="${LC_CTYPE:-$LANG}"
