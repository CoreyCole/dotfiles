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

-- Dictation keys from before Alt + Space and Right Alt became the defaults.
-- Remove these lines to give the keys back to applications.
if o.dictation_installed and o.dictation_installed() then
  o.bind("SUPER + CTRL + X", "Toggle dictation", "omarchy-dictation toggle")
  o.bind_hold("F9", "Start dictation (push-to-talk)", "omarchy-dictation start", "Stop dictation (push-to-talk)", "omarchy-dictation stop")
end
