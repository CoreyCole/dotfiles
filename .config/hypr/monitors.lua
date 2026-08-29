-- See https://wiki.hypr.land/Configuring/Basics/Monitors/
-- List current monitors and supported resolutions with: hyprctl monitors all

local dell = "desc:Dell Inc. DELL U2717D"
local seanix = "desc:Seanix Technology Inc NX-EDG27  NIX27F17"
local lg_monitor = "desc:LG Electronics 32GK650G"
local lg_hdr = "desc:LG Electronics LG HDR 4K 0x0000E053"
local lg_tv = "desc:LG Electronics LG TV"

hl.env("GDK_SCALE", "1")

hl.monitor({ output = dell, mode = "2560x1440", position = "0x0", scale = 1, transform = 1 })
hl.monitor({ output = seanix, mode = "2560x1440@144", position = "0x0", scale = 1, transform = 1 })
hl.monitor({ output = lg_monitor, mode = "2560x1440", position = "1440x0", scale = 1 })
hl.monitor({ output = lg_tv, mode = "3840x2160", position = "4000x0", scale = 1 })
hl.monitor({ output = "", mode = "preferred", position = "auto", scale = 1 })

local function first_connected(selectors)
	for _, selector in ipairs(selectors) do
		if hl.get_monitor(selector) then
			return selector
		end
	end
end

local function assign_workspaces(monitor, first, last)
	if not monitor then
		return
	end

	for workspace = first, last do
		hl.workspace_rule({
			workspace = tostring(workspace),
			monitor = monitor,
			default = workspace == first,
			persistent = true,
		})
	end
end

local function assign_connected_workspaces()
	assign_workspaces(first_connected({ dell, seanix }), 1, 3)
	assign_workspaces(first_connected({ lg_monitor, lg_hdr }), 4, 6)
	assign_workspaces(first_connected({ lg_tv }), 7, 10)
end

assign_connected_workspaces()
hl.on("monitor.added", assign_connected_workspaces)
hl.on("monitor.removed", assign_connected_workspaces)
