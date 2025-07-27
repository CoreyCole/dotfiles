# Build a QEMU VM image with: nix build .#nixosConfigurations.vm-qemu.config.system.build.qcow2
{ config, pkgs, lib, modulesPath, ... }:

{
  imports = [
    "${modulesPath}/profiles/qemu-guest.nix"
    ./machines/vm-qemu.nix
  ];

  # Disk configuration for image
  fileSystems."/" = {
    device = "/dev/disk/by-label/nixos";
    autoResize = true;
    fsType = "ext4";
  };

  fileSystems."/boot" = {
    device = "/dev/disk/by-label/boot";
    fsType = "vfat";
  };

  boot.growPartition = true;
  boot.loader.grub.device = "/dev/vda";
  boot.loader.timeout = 0;

  # Create a user with sudo access
  users.users.coreycole = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    initialPassword = "nixos";
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPChAGavE8sbsFrjqo0OQZ746BTJl27YU0HXWLDVXt+5 coreyleoc@gmail.com"
    ];
  };

  # Enable SSH
  services.openssh.enable = true;

  # System packages
  environment.systemPackages = with pkgs; [
    vim
    git
    home-manager
  ];
}