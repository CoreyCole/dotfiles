# Window Borders (`~/.config/hypr/looknfeel.conf`)

Edge-to-edge tiling with active window border only:

```
general {
    gaps_in = 0
    gaps_out = 0
    border_size = 2
    col.active_border = rgba(ff5555ff)      # red
    col.inactive_border = rgba(000000ff)    # solid black (blends with dark windows)
}
```

**Gotcha:** Never use a transparent inactive border (`rgba(00000000)`) with zero gaps — the border still reserves space, so the wallpaper bleeds through creating a visible gutter. Use solid black instead.
