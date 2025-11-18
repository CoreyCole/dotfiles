{
  description = "Example nix-darwin system flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";
    nix-homebrew.url = "github:zhaofengli-wip/nix-homebrew";
  };

  outputs = inputs @ {
    self,
    nix-darwin,
    nixpkgs,
    nix-homebrew,
  }: let
    configuration = {pkgs, ...}: {
      # List packages installed in system profile. To search by name, run:
      # $ nix-env -qaP | grep wget
      environment.systemPackages = [
        pkgs.vim
        pkgs.go
        pkgs.direnv # Directory-based environment variables
        pkgs.fd
        pkgs.ripgrep
        pkgs.codespell # Spell checker for source code
        pkgs.templ # HTML templating language for Go
        pkgs.alejandra # Nix code formatter
        pkgs.graphite-cli
        pkgs.gnupg
        pkgs.gnugrep
        pkgs.delta
        pkgs.just
        pkgs.gh

        # Language Servers and Formatters
        # Lua
        pkgs.lua-language-server # LSP for Lua (used in Neovim configs)
        pkgs.stylua # Lua code formatter

        # Python
        pkgs.uv # depedency management and runtime
        pkgs.mypy # Python static type checker
        pkgs.ruff # Fast Python linter and formatter (replaces black, isort, flake8)
        pkgs.pyright # Python LSP from Microsoft

        # Go
        pkgs.gopls # Official Go language server
        pkgs.golangci-lint # Go linters aggregator
        pkgs.golangci-lint-langserver # LSP wrapper for golangci-lint
        pkgs.delve # Go debugger
        pkgs.gotools # Various Go tools (goimports, godoc, etc.)

        # Web/HTML/CSS/JS/TS
        pkgs.typescript-go
        pkgs.tailwindcss-language-server # Tailwind CSS IntelliSense
        pkgs.vscode-langservers-extracted # Bundle: HTML, CSS, JSON, ESLint language servers
        pkgs.prettierd # Prettier daemon for faster formatting
        pkgs.eslint_d # ESLint daemon for faster linting
        pkgs.yaml-language-server # YAML language server

        # Rust
        pkgs.rust-analyzer # Official Rust language server
        pkgs.rustywind # Tailwind CSS class sorter for Rust/HTML

        # Shell
        pkgs.bash-language-server # Bash LSP
        pkgs.shfmt # Shell script formatter (bash/zsh)

        # C/C++
        pkgs.clang-tools # C/C++ tools (includes clangd LSP and clang-format)

        # Protocol Buffers
        pkgs.buf # Protocol buffer tool (lint, breaking change detection)
        pkgs.protols # Protocol buffer language server
        pkgs.protolint # Protocol buffer linter

        # SQL
        pkgs.sqls # SQL language server (GeoffTearle fork via overlay)
        pkgs.sqruff # SQL formatter
        pkgs.sqlc # Generate type-safe Go code from SQL
        pkgs.postgresql # PostgreSQL database (includes psql client)
      ];

      # Necessary for using flakes on this system.
      nix = {
        settings = {
          experimental-features = ["nix-command" "flakes"];
        };
      };

      # Enable alternative shell support in nix-darwin.
      # programs.fish.enable = true;

      # Set Git commit hash for darwin-version.
      system.configurationRevision = self.rev or self.dirtyRev or null;

      # Used for backwards compatibility, please read the changelog before changing.
      # $ darwin-rebuild changelog
      system.stateVersion = 6;

      # Set the primary user for homebrew and other user-specific options
      system.primaryUser = "coreycole";

      # The platform the configuration will be used on.
      nixpkgs.hostPlatform = "aarch64-darwin";

      # Configure nixpkgs overlays
      nixpkgs.config.allowUnfree = true;
      nixpkgs.overlays = [
        (self: super: {
          sqls = super.sqls.overrideAttrs {
            version = "7c572b8b1e58b30a357403a3959ba5752cae5350";
            src = self.fetchFromGitHub {
              owner = "GeoffTearle";
              repo = "sqls";
              rev = "7c572b8b1e58b30a357403a3959ba5752cae5350";
              hash = "sha256-pi7k68MuaBog8kSzonH9Y00Brt3FOYcNLhKFriH//78=";
            };
            vendorHash = "sha256-8jzecLaVUMlIJC2neb5XfvpBYIkkXnzvzq175ZBAnLo=";
          };
        })
        (self: super: {
          golangci-lint-langserver = super.golangci-lint-langserver.overrideAttrs {
            version = "develop-sha256-BZHax9xC+vpAOX9Fs7ml8m5ghbEHFumMhdPRWKDULOw=";
            src = self.fetchFromGitHub {
              owner = "GeoffTearle";
              repo = "golangci-lint-langserver";
              rev = "32a4976d189706b56c2413ede70248237150c959";
              sha256 = "sha256-jt27Oac1CYMCLDXq9hqILlIuYV2qUA6zu3u/fgnu1Zw=";
            };
            doCheck = false;
          };
        })
      ];

      # sudo with touch ID
      security.pam.services.sudo_local.touchIdAuth = true;
    };
  in {
    # Build darwin flake using:
    # $ darwin-rebuild build --flake .#simple
    darwinConfigurations."Coreys-MacBook-Pro-2" = nix-darwin.lib.darwinSystem {
      modules = [
        configuration
        nix-homebrew.darwinModules.nix-homebrew
        {
          nix-homebrew = {
            # Install Homebrew under the default prefix
            enable = true;

            # Apple Silicon: Also install Homebrew under Intel prefix for Rosetta 2
            enableRosetta = true;

            # User owning the Homebrew prefix
            user = "coreycole";

            # Automatically migrate existing Homebrew installations
            autoMigrate = true;
          };

          # Use nix-darwin's homebrew module to manage packages
          homebrew = {
            enable = true;
            # onActivation.cleanup = "uninstall"; # COMMENTED OUT - was removing existing packages!

            taps = [
              "localstack/tap"
            ];

            casks = [
              "virtualbox"
              "1password-cli"
              "alt-tab"
              "arc"
              "finicky"
              "orbstack"
              "rectangle"
              "signal"
              "slack"
              "wezterm"
            ];

            # Command-line tools installed via Homebrew formulas
            brews = [
              "fnm" # Fast Node Manager
              "fzf" # Command-line fuzzy finder
              "tmux"
              "cmake"
              "ninja"
              "gettext"
              "curl"
              "git"
              "localstack-cli" # LocalStack CLI
              "pspg"
            ];
          };
        }
      ];
    };
  };
}
