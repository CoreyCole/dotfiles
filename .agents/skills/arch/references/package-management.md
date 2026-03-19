# Package Management

## pacman

```bash
# Full system upgrade (always do this before installing new packages)
sudo pacman -Syu

# Install / remove
sudo pacman -S package_name
sudo pacman -Rs package_name        # remove + unused deps

# Search & info
pacman -Ss search_term               # search repos
pacman -Si package_name              # repo package info
pacman -Qs search_term               # search installed
pacman -Qi package_name              # installed package info
pacman -Qo /path/to/file             # which package owns this file?
pacman -Ql package_name              # list files in package
pacman -Qe                           # explicitly installed packages
pacman -Qm                           # foreign (AUR) packages

# Cache management
sudo pacman -Sc                      # remove old cached packages
sudo pacman -Scc                     # remove ALL cached packages
paccache -r                          # keep only last 3 versions (pacman-contrib)

# Check for orphaned packages
pacman -Qtdq                         # list orphans
sudo pacman -Rns $(pacman -Qtdq)     # remove orphans
```

## AUR (yay)

```bash
# Search and install AUR packages
yay -Ss search_term
yay search_term                      # interactive search
yay -S package_name

# Update all packages (official + AUR)
yay -Syu

# Show AUR package info
yay -Si package_name

# Clean unneeded build deps
yay -Yc

# Edit PKGBUILD before building (always review AUR packages!)
yay -S package_name --editmenu
```

## Common Package Errors

```bash
# "unable to lock database"
# First check if another pacman process is running:
ps aux | grep pacman
# Only if no pacman is running:
sudo rm /var/lib/pacman/db.lck

# "conflicting files" — identify owner first
pacman -Qo /path/to/conflicting/file
# If orphaned (no owner), safe to overwrite:
sudo pacman -S package --overwrite '/path/to/file'

# "failed to commit transaction (invalid or corrupted package)"
sudo pacman -Scc && sudo pacman -Syyu

# "key is unknown" / PGP signature errors
sudo pacman-key --refresh-keys
# Or for a specific key:
sudo pacman-key --recv-keys KEY_ID
sudo pacman-key --lsign-key KEY_ID

# Partial upgrade breakage (never run pacman -Sy without -u)
# Boot from Arch ISO, mount, arch-chroot, then:
pacman -Syu
```
