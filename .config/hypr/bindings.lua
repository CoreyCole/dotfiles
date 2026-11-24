-- Keep only your personal keybinding overrides here. Add new bindings or
-- unbind defaults before replacing them.

-- See current bindings and descriptions:
--   omarchy menu keybindings --print

-- To disable every Omarchy default binding, set this in
-- ~/.config/hypr/hyprland.lua before require("default.hypr.omarchy"), then add
-- only the bindings you want below:
--   omarchy_default_bindings = false

-- To disable all preinstalled app/webapp bindings, set:
--   omarchy_preinstalled_bindings = false

-- Launch the configured default coding agent.
o.bind("SUPER + grave", "Agent", "omarchy-agent --pick")

-- Full-width stacked split on the focused portrait monitor (Dell / Seanix).
-- Reapplies; does nothing on landscape monitors.
o.bind("SUPER + SHIFT + J", "Stack portrait windows", function()
	stack_portrait_windows()
end)

-- Find game class/title values: hyprctl clients -j | jq '.[] | {class, title}'
-- Matches are exact. Omit title only if the class belongs exclusively to the game.
local games = {
	{ class = "steam_app_battlenet", title = "StarCraft II" },
}

-- o.bind does not return a handle; hl.bind lets game mode disable these bindings.
local desktop_bindings = {
	hl.bind("ALT + X", hl.dsp.exec_cmd("~/.config/hypr/scripts/rcmd-focus.sh X '^com\\.mitchellh\\.ghostty$'"), {
		description = "Raise terminal windows",
	}),
	hl.bind(
		"ALT + SHIFT + X",
		hl.dsp.exec_cmd("~/.config/hypr/scripts/rcmd-focus.sh --cycle-window X '^com\\.mitchellh\\.ghostty$'"),
		{ description = "Cycle terminal windows" }
	),
	hl.bind("ALT + Z", hl.dsp.exec_cmd("~/.config/hypr/scripts/rcmd-focus.sh Z '^zen$'"), {
		description = "Raise Zen windows",
	}),
	hl.bind(
		"ALT + SHIFT + Z",
		hl.dsp.exec_cmd("~/.config/hypr/scripts/rcmd-focus.sh --cycle-window Z '^zen$'"),
		{ description = "Cycle browser windows" }
	),
}

local game_focused
local function update_game_mode(window)
	local playing = false
	if window then
		for _, game in ipairs(games) do
			if window.class == game.class and (not game.title or window.title == game.title) then
				playing = true
				break
			end
		end
	end
	if playing == game_focused then
		return
	end
	game_focused = playing
	for _, binding in ipairs(desktop_bindings) do
		binding:set_enabled(not playing)
	end
	-- keyd must not map Caps Lock first: sudo systemctl disable --now keyd
	hl.config({ input = { kb_options = playing and "compose:ralt" or "caps:escape,compose:ralt" } })
end

hl.on("window.active", update_game_mode)
for _, event in ipairs({ "window.title", "window.class" }) do
	hl.on(event, function(window)
		if window.active then
			update_game_mode(window)
		end
	end)
end
hl.on("config.reloaded", function()
	update_game_mode(hl.get_active_window())
end)
update_game_mode(hl.get_active_window())

-- Add a new binding.
-- o.bind("SUPER + SHIFT + R", "SSH", "alacritty -e ssh your-server")

-- Change an existing binding by unbinding it first, then binding the key again.
-- This example changes SUPER+SPACE from the launcher to the Omarchy root menu.
-- hl.unbind("SUPER + SPACE")
-- o.bind("SUPER + SPACE", "Omarchy menu", "omarchy-menu toggle root")

-- Disable a default binding without replacing it.
-- hl.unbind("SUPER + SHIFT + B")

-- Logitech MX Keys examples:
-- o.bind("SUPER + SHIFT + S", nil, "omarchy-capture-screenshot")
-- o.bind("SUPER + H", nil, "voxtype record toggle")
-- o.bind("SUPER + PERIOD", nil, "omarchy-shell shell toggle omarchy.emojis")

-- 1-3 are the vertical monitor, 4-6 the LG, 7-0 the TV. Not 1-5 on every screen.
local workspace_groups = {
	{
		monitors = { "desc:Dell Inc. DELL U2717D", "desc:Seanix Technology Inc NX-EDG27  NIX27F17" },
		first = 1,
		last = 3,
	},
	{
		monitors = { "desc:LG Electronics 32GK650G", "desc:LG Electronics LG HDR 4K 0x0000E053" },
		first = 4,
		last = 6,
	},
	{
		monitors = { "desc:LG Electronics LG TV" },
		first = 7,
		last = 10,
	},
}

local function assigned_target(number)
	for _, group in ipairs(workspace_groups) do
		if number >= group.first and number <= group.last then
			for _, selector in ipairs(group.monitors) do
				local monitor = hl.get_monitor(selector)
				if monitor then
					return monitor, number - group.first + 1
				end
			end
			return nil
		end
	end
end

local function group_for_monitor(monitor)
	if not monitor then
		return nil
	end
	for _, group in ipairs(workspace_groups) do
		for _, selector in ipairs(group.monitors) do
			local found = hl.get_monitor(selector)
			if found and found.id == monitor.id then
				return group
			end
		end
	end
end

local function allowed_count(group)
	return group.last - group.first + 1
end

local function slot_of(id)
	return ((id - 1) % 10) + 1
end

local function focus_assigned_workspace(number)
	local monitor, slot = assigned_target(number)
	if not monitor then
		return
	end
	o.workspaces.focus(slot, monitor.name)()
end

local function move_to_assigned_workspace(number, follow)
	local monitor, slot = assigned_target(number)
	local window = hl.get_active_window()
	if not monitor or not window then
		return
	end

	local id = tostring(o.workspaces.workspace_id(monitor, slot))
	hl.dispatch(hl.dsp.window.move({
		workspace = id,
		follow = false,
		window = "address:" .. window.address,
	}))
	local workspace = hl.get_workspace(id)
	if not workspace or not workspace.monitor or workspace.monitor.name ~= monitor.name then
		hl.dispatch(hl.dsp.workspace.move({ workspace = id, monitor = monitor.name }))
	end
	if follow ~= false then
		hl.dispatch(hl.dsp.focus({ workspace = id }))
	end
end

-- The keybind runs this file's lambda. A function defined in another required
-- file is not visible here, which is the "nil value (global ...)" error.
_G.focus_assigned_workspace = focus_assigned_workspace
_G.move_to_assigned_workspace = move_to_assigned_workspace

for number = 1, 10 do
	local key = "code:" .. tostring(number + 9)
	local n = number
	local label = n == 10 and "0" or tostring(n)
	o.rebind("SUPER + " .. key, "Switch to workspace " .. label, function()
		focus_assigned_workspace(n)
	end)
	o.rebind("SUPER + SHIFT + " .. key, "Move window to workspace " .. label, function()
		move_to_assigned_workspace(n, true)
	end)
	o.rebind("SUPER + SHIFT + ALT + " .. key, "Move window silently to workspace " .. label, function()
		move_to_assigned_workspace(n, false)
	end)
end

-- Tab and scroll walk the focused monitor's own 1-10. Stop at the strip edge
-- so they cannot open a fourth workspace on the left or the right.
local function cycle_assigned(delta)
	local monitor = hl.get_active_monitor()
	local group = group_for_monitor(monitor)
	if not monitor or not group then
		return
	end

	local count = allowed_count(group)
	local active = monitor.active_workspace
	local slot = 1
	if active and active.id and active.id > 0 then
		slot = slot_of(active.id)
	end
	if slot < 1 or slot > count then
		slot = 1
	end

	local next_slot = slot + delta
	if next_slot < 1 or next_slot > count then
		return
	end
	o.workspaces.focus(next_slot, monitor.name)()
end

o.rebind("SUPER + TAB", "Next workspace", function()
	cycle_assigned(1)
end)
o.rebind("SUPER + SHIFT + TAB", "Previous workspace", function()
	cycle_assigned(-1)
end)
o.rebind("SUPER + mouse_down", "Scroll active workspace forward", function()
	cycle_assigned(1)
end)
o.rebind("SUPER + mouse_up", "Scroll active workspace backward", function()
	cycle_assigned(-1)
end)

local confining = false

local function move_window_to(window, monitor, slot)
	if not window or not monitor or not window.address then
		return
	end
	local id = tostring(o.workspaces.workspace_id(monitor, slot))
	hl.dispatch(hl.dsp.window.move({
		workspace = id,
		follow = false,
		window = "address:" .. window.address,
	}))
end

local function settle_monitor(monitor)
	local group = group_for_monitor(monitor)
	if not monitor or not group then
		return
	end
	local active = monitor.active_workspace
	if not active or not active.id or active.id < 1 then
		return
	end
	if slot_of(active.id) <= allowed_count(group) then
		return
	end
	o.workspaces.focus(allowed_count(group), monitor.name)()
end

-- 1-3 stay on the vertical monitor, 4-6 on the LG, 7-10 on the TV.
-- A window that lands past that screen's slots moves to the last allowed slot.
local function confine_window(window)
	if confining or not window or not window.workspace then
		return
	end
	local workspace = window.workspace
	local id = workspace.id
	if not id or id < 1 or workspace.special then
		return
	end

	local monitor = workspace.monitor or (hl.get_workspace(tostring(id)) or {}).monitor
	if not monitor then
		return
	end

	local target_monitor, target_slot
	if id <= 10 then
		target_monitor, target_slot = assigned_target(id)
	end

	local group = group_for_monitor(monitor)
	if not target_monitor and group and slot_of(id) > allowed_count(group) then
		target_monitor = monitor
		target_slot = allowed_count(group)
	end
	if not target_monitor or not target_slot then
		return
	end
	if target_monitor.name == monitor.name and slot_of(id) == target_slot then
		return
	end

	confining = true
	move_window_to(window, target_monitor, target_slot)
	settle_monitor(monitor)
	confining = false
end

local function confine_later(window)
	hl.timer(function()
		confine_window(window)
	end, { type = "oneshot", timeout = 30 })
end

hl.on("window.open", confine_later)
hl.on("window.move_to_workspace", confine_later)

-- Dictation keys from before Alt + Space and Right Alt became the defaults.
-- Remove these lines to give the keys back to applications.
if o.dictation_installed and o.dictation_installed() then
  o.bind("SUPER + CTRL + X", "Toggle dictation", "omarchy-dictation toggle")
  o.bind_hold("F9", "Start dictation (push-to-talk)", "omarchy-dictation start", "Stop dictation (push-to-talk)", "omarchy-dictation stop")
end
