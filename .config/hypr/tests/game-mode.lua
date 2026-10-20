-- Run from the dotfiles root: lua .config/hypr/tests/game-mode.lua
local function load_bindings(active)
	local state = { active = active, bindings = {}, events = {}, writes = 0 }
	o = { bind = function() end }
	hl = {
		dsp = {
			exec_cmd = function(command)
				return command
			end,
		},
		bind = function(keys, command, options)
			local binding = { keys = keys, command = command, description = options.description, enabled = true }
			function binding:set_enabled(enabled)
				self.enabled = enabled
			end
			table.insert(state.bindings, binding)
			return binding
		end,
		config = function(config)
			state.options = config.input.kb_options
			state.writes = state.writes + 1
		end,
		get_active_window = function()
			return state.active
		end,
		on = function(event, callback)
			state.events[event] = callback
		end,
	}
	dofile(".config/hypr/bindings.lua")
	function state:check(playing)
		assert(#self.bindings == 4)
		for _, binding in ipairs(self.bindings) do
			assert(binding.enabled == not playing, binding.keys)
		end
		assert(self.options == (playing and "compose:ralt" or "caps:escape,compose:ralt"))
	end
	function state:focus(window)
		self.active = window
		self.events["window.active"](window)
	end
	return state
end

local game = { class = "steam_app_battlenet", title = "StarCraft II", active = true }
local desktop = { class = "com.mitchellh.ghostty", title = "Terminal", active = true }
local launcher = { class = "steam_app_battlenet", title = "Battle.net", active = true }
local state = load_bindings(desktop)
state:check(false)
state:focus(game)
state:check(true)
state:focus(game)
assert(state.writes == 2, "unchanged focus must not rewrite the keyboard map")
state.events["window.title"]({ class = game.class, title = game.title, active = false })
state:check(true)
assert(state.writes == 2, "background title changes must not change game mode")
state:focus(launcher)
state:check(false)
state:focus({ class = "unrelated", title = "StarCraft II", active = true })
state:check(false)
state:focus(game)
game.title = "Battle.net"
state.events["window.title"](game)
state:check(false)
game.title = "StarCraft II"
state.events["window.title"](game)
state:check(true)
game.class = "unrelated"
state.events["window.class"](game)
state:check(false)
game.class = "steam_app_battlenet"
state.events["window.class"](game)
state:check(true)
state:focus(nil)
state:check(false)
state:focus(game)
state:focus(desktop)
state:check(false)

-- Reloads must initialize from focus without needing a new focus event.
state = load_bindings(game)
state:check(true)
state.events["config.reloaded"]()
state:check(true)
assert(state.writes == 1)
state = load_bindings(nil)
state:check(false)
print("game mode: focus, matching, title/class changes, no-focus, and reload tests passed")
