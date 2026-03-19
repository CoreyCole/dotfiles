# Network (systemd-networkd + iwd)

This system uses **systemd-networkd** for network management and **iwd** for Wi-Fi — NOT NetworkManager.

```bash
# Check network interfaces
ip link
ip addr

# DNS resolution (systemd-resolved)
resolvectl status

# Restart networking
sudo systemctl restart systemd-networkd
sudo systemctl restart systemd-resolved

# Wi-Fi (iwd via iwctl)
iwctl station wlan0 scan
iwctl station wlan0 get-networks
iwctl station wlan0 connect SSID

# Check Wi-Fi status
iwctl station wlan0 show

# iwd known networks
iwctl known-networks list

# Check open ports
ss -tulnp

# Network config files
# /etc/systemd/network/*.network
# /var/lib/iwd/ (Wi-Fi profiles)
```
