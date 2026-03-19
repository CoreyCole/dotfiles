# Limine Bootloader

Config: `/boot/limine.conf` or `/boot/limine/limine.conf`

```bash
# After kernel update, regenerate initramfs
sudo mkinitcpio -P

# Limine config example entry:
# /Arch Linux
#     PROTOCOL=linux
#     KERNEL_PATH=boot():/vmlinuz-linux
#     CMDLINE=root=/dev/sdXn rw
#     MODULE_PATH=boot():/initramfs-linux.img

# Reinstall Limine to disk (if boot broken)
sudo limine bios-install /dev/sdX      # BIOS/MBR
# For UEFI: copy limine files to ESP
```

## Kernel & Hardware

```bash
# Current kernel
uname -r

# List installed kernels
pacman -Q | grep linux | grep -v lib

# Regenerate initramfs for all presets
sudo mkinitcpio -P

# View kernel messages
dmesg
dmesg -w                                # follow live
journalctl -b -k                        # kernel log, current boot

# Loaded modules
lsmod
modinfo module_name

# Load / unload module
sudo modprobe module_name
sudo modprobe -r module_name

# Blacklist a module: /etc/modprobe.d/blacklist.conf
# blacklist module_name
```

## System Won't Boot

1. Boot from Arch ISO USB
2. Mount your root partition: `mount /dev/sdXn /mnt`
3. If btrfs, mount subvolume: `mount -o subvol=@ /dev/sdXn /mnt`
4. Mount boot: `mount /dev/sdXn /mnt/boot`
5. Chroot: `arch-chroot /mnt`
6. Check `journalctl -b -1` for previous boot errors
7. Regenerate initramfs: `mkinitcpio -P`
8. Check bootloader config: `cat /boot/limine.conf`
9. If package broke things, downgrade or `pacman -Syu`
