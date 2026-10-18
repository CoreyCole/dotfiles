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

-- Full-width equal stack on the focused portrait monitor. Reapply-only, never toggles.
local function collapse_scrolling_workspace(id)
	local ws = hl.get_workspace(id)
	if not ws or ws.tiled_layout ~= "scrolling" or (ws.windows or 0) < 2 then
		return
	end

	local wins = ws:get_windows()
	if not wins then
		return
	end

	local leftmost
	local columns = {}
	local column_count = 0
	for _, window in ipairs(wins) do
		if not window.floating and window.at then
			if not leftmost or window.at.x < leftmost.at.x then
				leftmost = window
			end
			if not columns[window.at.x] then
				columns[window.at.x] = true
				column_count = column_count + 1
			end
		end
	end

	if not leftmost or column_count < 2 then
		return
	end

	hl.dispatch(hl.dsp.focus({ window = leftmost }))
	for _ = 1, column_count - 1 do
		hl.dispatch(hl.dsp.layout("consume"))
	end
end

local function focused_portrait_monitor()
	local active = hl.get_active_monitor()
	if not active then
		return nil
	end

	for _, selector in ipairs({ dell, seanix }) do
		local monitor = hl.get_monitor(selector)
		if monitor and monitor.id == active.id then
			return active
		end
	end
end

function stack_portrait_windows()
	if not focused_portrait_monitor() then
		return
	end

	local ws = hl.get_active_workspace()
	if not ws then
		return
	end

	local active = hl.get_active_window()
	local id = ws.id

	hl.workspace_rule({
		workspace = tostring(id),
		layout = "scrolling",
	})

	local function restack()
		collapse_scrolling_workspace(id)
		if active then
			hl.dispatch(hl.dsp.focus({ window = active }))
		end
	end

	restack()
	hl.timer(restack, { timeout = 80, type = "oneshot" })
	hl.timer(restack, { timeout = 250, type = "oneshot" })
end
