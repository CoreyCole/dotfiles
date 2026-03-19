# PipeWire Audio

```bash
# Check PipeWire status
systemctl --user status pipewire pipewire-pulse wireplumber

# Restart audio stack
systemctl --user restart pipewire pipewire-pulse wireplumber

# List audio devices
wpctl status

# Set default sink (output)
wpctl set-default SINK_ID

# Set volume
wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.5        # 50%
wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+         # increase 5%
wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-         # decrease 5%

# Mute/unmute
wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle

# Interactive TUI
pavucontrol                                        # GUI mixer
```

## No Audio After Update

```bash
# Restart the full audio stack
systemctl --user restart pipewire pipewire-pulse wireplumber

# Check if devices are detected
wpctl status

# Check for muted sinks
wpctl get-volume @DEFAULT_AUDIO_SINK@

# Check logs
journalctl --user -u pipewire -b
journalctl --user -u wireplumber -b

# Nuclear option: remove config and restart
rm -rf ~/.local/state/wireplumber/
systemctl --user restart wireplumber
```
