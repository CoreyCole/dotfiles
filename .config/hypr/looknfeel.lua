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
