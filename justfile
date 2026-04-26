# List available recipes.
default:
  @just --list

# Format, commit, pull --rebase, and push changed thoughts/ artifacts.
sync-thoughts:
  @./scripts/sync-thoughts.sh
