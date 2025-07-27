{
  description = "Custom NixOS ISO for QEMU/KVM";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { self, nixpkgs }: {
    nixosConfigurations = {
      qemu-iso = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          "${nixpkgs}/nixos/modules/installer/cd-dvd/installation-cd-minimal.nix"
          ({ pkgs, ... }: {
            # Enable SSH with password auth
            services.openssh = {
              enable = true;
              settings = {
                PermitRootLogin = "yes";
                PasswordAuthentication = true;
              };
            };

            # Set root password
            users.users.root.initialPassword = "nixos";

            # QEMU guest support
            services.qemuGuest.enable = true;
            services.spice-vdagentd.enable = true;

            # Include useful tools
            environment.systemPackages = with pkgs; [
              vim
              git
              parted
              gptfdisk
              spice-gtk
            ];

            # Better console
            console.keyMap = "us";
            
            # Enable flakes
            nix.settings.experimental-features = [ "nix-command" "flakes" ];
          })
        ];
      };
    };
  };
}