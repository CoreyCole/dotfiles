# Systemd Services

```bash
# Start / stop / restart
sudo systemctl start service_name
sudo systemctl stop service_name
sudo systemctl restart service_name

# Enable at boot / disable
sudo systemctl enable service_name
sudo systemctl enable --now service_name   # enable + start immediately
sudo systemctl disable service_name

# Status & logs
systemctl status service_name
journalctl -u service_name                  # all logs for service
journalctl -u service_name -b               # logs from current boot
journalctl -u service_name -f               # follow live
journalctl -b                               # all logs, current boot
journalctl -b -1                            # previous boot logs
journalctl -p err -b                        # only errors, current boot

# User services (no sudo)
systemctl --user status service_name
systemctl --user restart service_name
journalctl --user -u service_name

# List failed services
systemctl --failed
```
