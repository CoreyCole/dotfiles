# Screen sharing on Hyprland

Use this reference when Firefox and Chromium both fail to share a screen after the user grants permission.

The shared path is: browser → XDG Desktop Portal → Hyprland portal → PipeWire.
A browser permission message does not prove that the user denied access.

## Read-only diagnosis

```bash
systemctl --user --no-pager --full status \
  xdg-desktop-portal.service xdg-desktop-portal-hyprland.service \
  pipewire.service wireplumber.service

busctl --user introspect org.freedesktop.portal.Desktop \
  /org/freedesktop/portal/desktop | grep -E 'ScreenCast|Screenshot'

systemctl --user show-environment | \
  grep -E '^(XDG_CURRENT_DESKTOP|XDG_SESSION_TYPE|WAYLAND_DISPLAY|HYPRLAND_INSTANCE_SIGNATURE)='

journalctl --user -b --no-pager \
  -u xdg-desktop-portal.service -u xdg-desktop-portal-hyprland.service \
  --since '30 minutes ago'
```

Inspect the environment of the running portal, not only the shell or systemd user manager:

```bash
pid=$(systemctl --user show xdg-desktop-portal.service --property=MainPID --value)
if [ "$pid" -gt 0 ]; then
  tr '\0' '\n' < "/proc/$pid/environ" | \
    grep -E '^(XDG_CURRENT_DESKTOP|XDG_SESSION_TYPE|WAYLAND_DISPLAY|HYPRLAND_INSTANCE_SIGNATURE)='
fi
```

| Evidence | Next step |
|---|---|
| `ScreenCast` is absent, and the Hyprland portal is inactive | Inspect the startup environment and portal logs before browser permissions. |
| The user manager has correct variables, but the running portal lacks them | After approval, restart the portals in the order below. |
| The user manager also lacks the variables | Investigate Hyprland/UWSM environment propagation first. Do not import a blank agent-shell environment. |
| `ScreenCast` exists, but capture still fails | Inspect the picker and PipeWire logs during a fresh attempt. Interface presence alone does not prove successful capture. |

For this session, expected manager values included `XDG_CURRENT_DESKTOP=Hyprland` and `XDG_SESSION_TYPE=wayland`.
`WAYLAND_DISPLAY` must name the active compositor socket. Do not hardcode `wayland-1` from this incident.

## Targeted repair

Before execution, explain the restart and obtain approval. These commands change no files and require no logout.
They can interrupt active screen shares and portal dialogs. They do not restart PipeWire or WirePlumber.

```bash
systemctl --user restart xdg-desktop-portal-hyprland.service
systemctl --user restart xdg-desktop-portal.service
```

Restart the Hyprland backend first, then the frontend portal so it can discover the backend.
Do not reset browser permissions, reinstall packages, or restart the audio stack as the first response to this signature.

After the restart, repeat the interface inspection and verify that both services are active:

```bash
systemctl --user is-active \
  xdg-desktop-portal-hyprland.service xdg-desktop-portal.service
```

Ask the user to retry the original browser flow. Confirm actual capture, not only service health.
If the fault recurs after login, investigate startup ordering and environment propagation. A restart is recovery, not proof of a permanent fix.

## Confirmed incident: 2026-10-16

| Stage | Observation |
|---|---|
| Symptom | Firefox and Chromium failed in Google Meet after permission approval. Firefox offered “Use operating system settings.” Meet reported “Meet needs permission to screen share.” |
| Before repair | The Hyprland portal was inactive. The frontend portal exposed neither `ScreenCast` nor `Screenshot`. |
| Environment | The running frontend lacked desktop/Wayland variables. The user manager had the correct session values. |
| Recovery | The user ran the two restart commands and confirmed that screen sharing worked. |
| Independent verification | Both services were active. The frontend exposed `org.freedesktop.portal.ScreenCast` and `org.freedesktop.portal.Screenshot`. |

The evidence supports stale portal startup state. It does not establish why the original startup environment lacked those variables.

## Sources

- [Arch Wiki: Portal does not start](https://wiki.archlinux.org/title/XDG_Desktop_Portal#Portal_does_not_start)
- [Arch Wiki: Portal configuration](https://wiki.archlinux.org/title/XDG_Desktop_Portal#Configuration)
- [Hyprland: xdg-desktop-portal-hyprland](https://wiki.hyprland.org/Hypr-Ecosystem/xdg-desktop-portal-hyprland/)
