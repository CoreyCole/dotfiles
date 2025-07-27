# QEMU/KVM specific configuration
{ config, pkgs, lib, ... }:

{
  imports = [
    ./hardware/vm-intel.nix
    ./vm-shared.nix
  ];

  # QEMU guest support
  services.qemuGuest.enable = true;
  services.spice-vdagentd.enable = true;

  # Additional packages for QEMU integration
  environment.systemPackages = with pkgs; [
    spice-gtk
    qemu_kvm
  ];

  # Enable virtio GPU for better graphics performance
  # This is handled by the kernel modules in hardware/vm-intel.nix

  # Network configuration for virtio
  networking.interfaces.ens3.useDHCP = lib.mkDefault true;
}