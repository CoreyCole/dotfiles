# Btrfs & Snapper

```bash
# List subvolumes
sudo btrfs subvolume list /

# Show filesystem usage
sudo btrfs filesystem usage /
btrfs filesystem df /

# Scrub (check integrity)
sudo btrfs scrub start /
sudo btrfs scrub status /

# Balance (rebalance data across devices)
sudo btrfs balance start /
sudo btrfs balance status /

# Snapper — list snapshots
sudo snapper list

# Create manual snapshot
sudo snapper create -d "before update"

# Compare snapshots
sudo snapper diff 1..2

# Undo changes between snapshots
sudo snapper undochange 1..2

# Delete old snapshots
sudo snapper delete SNAPSHOT_NUMBER

# Snapper config
sudo snapper list-configs
cat /etc/snapper/configs/root
```

## Snapper Rollback

```bash
# List snapshots to find pre-update state
sudo snapper list

# Compare what changed
sudo snapper diff PRE..POST

# Undo changes
sudo snapper undochange PRE..POST

# Or restore a snapshot (btrfs)
# Boot from ISO, mount btrfs root, mv broken subvol, snapshot good one
```
