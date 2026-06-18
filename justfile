# List available recipes.
default:
  @just --list

# Configure this dotfiles checkout.
setup:
  git config core.hooksPath hooks
  @echo "Configured git hooks path: $(git config --get core.hooksPath)"
  mkdir -p context
  @if [ ! -d context/vamos/.git ]; then \
    echo "Cloning vamos context checkout"; \
    git clone https://github.com/CoreyCole/vamos.git context/vamos; \
  else \
    echo "Vamos context checkout already exists"; \
  fi
  ./hooks/post-pull
  ./.pi-config/setup.sh

# Format, commit, pull --rebase, and push changed thoughts/ artifacts.
sync-thoughts:
  @./scripts/sync-thoughts.sh
