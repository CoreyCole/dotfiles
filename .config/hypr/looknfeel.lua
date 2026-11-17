-- Personal appearance overrides loaded after Omarchy defaults and the theme.

hl.config({
	general = {
		gaps_in = 0,
		gaps_out = 0,
		border_size = 2,
		col = {
			active_border = "rgba(ff5555ff)",
			inactive_border = "rgba(000000ff)",
		},
	},
	decoration = {
		blur = {
			enabled = false,
		},
	},
})

-- Force normal windows fully opaque.
o.window(".*", { opacity = "1 1" })

-- Ignore terminal activation requests. Hyprland's activate path focuses the
-- window and warps the pointer. Herdr bells must not do either.
-- New launches still focus. Omarchy keeps misc.focus_on_activate on for other apps.
o.window({ tag = "terminal" }, { focus_on_activate = false })
o.window({ tag = "terminal" }, { suppress_event = "activate" })

-- Opt another application in to Omarchy's standard transparency.
-- Find its class with: hyprctl clients
-- o.transparent_window("my-app")
-- o.transparent_window("my-app", "0.9 0.85") -- Custom active/inactive opacity.
