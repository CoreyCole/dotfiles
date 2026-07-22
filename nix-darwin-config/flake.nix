{
  description = "Example nix-darwin system flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";
    nix-homebrew.url = "github:zhaofengli-wip/nix-homebrew";
    determinate.url = "https://flakehub.com/f/DeterminateSystems/determinate/3";
  };

  outputs = inputs @ {
    self,
    nix-darwin,
    nixpkgs,
    nix-homebrew,
    determinate,
  }: let
    configuration = {pkgs, ...}: let
      ghosttyTerminfo = pkgs.runCommand "ghostty-terminfo" {nativeBuildInputs = [pkgs.ncurses];} ''
        mkdir -p $out/share/terminfo
        TERMINFO=$out/share/terminfo tic -x ${./ghostty.terminfo}
      '';
    in {
      # List packages installed in system profile. To search by name, run:
      # $ nix-env -qaP | grep wget
      environment.systemPackages = [
        pkgs.vim
        pkgs.go
        pkgs.direnv # Directory-based environment variables
        pkgs.fzf # Command-line fuzzy finder (ctrl+r history, ctrl+t files, alt+c dirs)
        pkgs.nix-direnv # Fast, persistent use_nix/use_flake for direnv
        pkgs.fd
        pkgs.ripgrep
        pkgs.codespell # Spell checker for source code
        pkgs.templ # HTML templating language for Go
        pkgs.alejandra # Nix code formatter
        pkgs.graphite-cli
        pkgs.gnupg
        pkgs.gnugrep
        pkgs.delta
        pkgs.tmux
        pkgs.just
        pkgs.gh
        pkgs.mergiraf
        pkgs.tailscale
        pkgs.lazygit
        pkgs.socat # Relay utility used by SSH ProxyCommand/SOCKS connections
        ghosttyTerminfo

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

        # Markdown
        (pkgs.python3.withPackages (ps:
          with ps; [
            mdformat
            mdformat-frontmatter
          ]))
      ];

      determinateNix.enable = true;
      # Necessary for using flakes on this system.
      # nix = {
      #   settings = {
      #     experimental-features = ["nix-command" "flakes"];
      #   };
      # };

      # Enable zsh with fzf integration for ctrl+r history search
      programs.zsh.enable = true;
      programs.zsh.interactiveShellInit = ''
        # Auto-start tmux inside cmux workspaces
        if [[ -n "$CMUX_WORKSPACE_ID" && -z "$TMUX" ]]; then
          exec tmux new-session -A -s "cmux-''${CMUX_WORKSPACE_ID}"
        fi

        eval "$(fzf --zsh)"
      '';

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
        (self: super: let
          sqlcVersion = "1.31.1";
          sqlcAsset =
            if super.stdenv.isDarwin && super.stdenv.hostPlatform.isAarch64
            then {
              name = "sqlc_${sqlcVersion}_darwin_arm64.tar.gz";
              hash = "sha256-IWAhWMmesfK64Zemar+xlB0enlCyMSW7GTNJxrGsxx4=";
            }
            else if super.stdenv.isDarwin && super.stdenv.hostPlatform.isx86_64
            then {
              name = "sqlc_${sqlcVersion}_darwin_amd64.tar.gz";
              hash = "sha256-xa92dy43hdIWY6YmlwVrOD8HYpl5sb0luThy5z29UZs=";
            }
            else if super.stdenv.isLinux && super.stdenv.hostPlatform.isAarch64
            then {
              name = "sqlc_${sqlcVersion}_linux_arm64.tar.gz";
              hash = "sha256-t8riR3QNDFGh5ldHnlstIeb+9Cj1lmgqAbxVv0q4oj0=";
            }
            else if super.stdenv.isLinux && super.stdenv.hostPlatform.isx86_64
            then {
              name = "sqlc_${sqlcVersion}_linux_amd64.tar.gz";
              hash = "sha256-SXrk/N+mTFsMMR/+TCvZkeQ5keguU2d5LteLwtyic1Q=";
            }
            else throw "unsupported system for sqlc";
        in {
          sqlc = super.stdenv.mkDerivation {
            pname = "sqlc";
            version = sqlcVersion;

            src = super.fetchurl {
              url = "https://github.com/sqlc-dev/sqlc/releases/download/v${sqlcVersion}/${sqlcAsset.name}";
              hash = sqlcAsset.hash;
            };

            sourceRoot = ".";
            dontConfigure = true;
            dontBuild = true;

            unpackPhase = ''
              tar -xzf "$src"
            '';

            installPhase = ''
              runHook preInstall
              install -Dm755 sqlc "$out/bin/sqlc"
              runHook postInstall
            '';

            meta = with super.lib; {
              description = "Compiler from SQL to type-safe code";
              homepage = "https://sqlc.dev";
              license = licenses.mit;
              platforms = platforms.darwin ++ platforms.linux;
              mainProgram = "sqlc";
            };
          };

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

      # Point xcrun at the real Command Line Tools so /usr/bin/clang works
      # (nix apple-sdk overrides xcode-select but doesn't ship a full toolchain)
      environment.variables.DEVELOPER_DIR = "/Library/Developer/CommandLineTools";

      # sudo with touch ID
      security.pam.services.sudo_local.touchIdAuth = true;

      # tailscale daemon (non-sandboxed, supports SSH server)
      services.tailscale.enable = true;
    };
    darwinModules = [
      determinate.darwinModules.default
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
            "manaflow-ai/cmux"
            "steipete/tap"
          ];

          casks = [
            "1password-cli"
            "arc"
            "finicky"
            "orbstack"
            "signal"
            "slack"
          ];

          # Command-line tools installed via Homebrew formulas
          brews = [
            "fnm" # Fast Node Manager
            "cmake"
            "ninja"
            "tree-sitter-cli" # Parser compiler required by nvim-treesitter
            "gettext"
            "curl"
            "git"
            "localstack-cli" # LocalStack CLI
            "pspg"
            "pkgconf"
            "gstreamer" # now includes all gst-plugins-* packages
            "ghostscript" # image/vector conversion support for pi-docparser/LiteParse
            "imagemagick" # image-to-PDF conversion support for pi-docparser/LiteParse
            "opus" # libopus for opusenc/opusdec
            "snowflake-cli" # Snowflake CLI (snow) for querying Snowflake
            "gogcli" # Google Workspace CLI (gog) - Gmail, Sheets, Drive, Calendar, etc.
          ];
        };
      }
    ];
  in {
    # Build darwin flake using:
    # $ darwin-rebuild switch --flake .
    darwinConfigurations."Coreys-MacBook-Pro" = nix-darwin.lib.darwinSystem {
      modules = darwinModules;
    };
    darwinConfigurations."Coreys-MacBook-Pro-2" = nix-darwin.lib.darwinSystem {
      modules = darwinModules;
    };
    darwinConfigurations."swarms-MacBook-Pro" = nix-darwin.lib.darwinSystem {
      modules =
        darwinModules
        ++ [
          ({lib, ...}: {
            system.primaryUser = lib.mkForce "swarm";
            nix-homebrew.user = lib.mkForce "swarm";
          })
        ];
    };
  };
}
