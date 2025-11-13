local M = {}

local header = {
    "                                             .... . .....                                           ",
    "                               .. ...-@@@@#----------------*@@@@...  .                              ",
    "                            ..-@@=----------------------------------@@.....                         ",
    "                        ..@@--------------------------------------------%@.        ....             ",
    "             ....    ..@=--------------------------------------------------#@..%@#---+@@..          ",
    "       ..#@+-----@@.%%-------=%@@@@@+--------------------%@.........:@=-------@----------@-..       ",
    "      .@---------=%+-----@@...     ....@#--------------@.. .. .       ..@-------@----------@.       ",
    "    ..@----------@-----@....            .-%----------@...              ..@-------@@@@-------@.      ",
    "   ..%-----@@@@@------#. .                .@--------@..                  .@-------%@@@------@.      ",
    "    %-----@@@@@------#.......             ..@------@....@@+.             ..@-------+@#------#.      ",
    "   .@-----@@@@------@...@@@@@..            .@-------..@@@@@@.             .@--------%-------@.      ",
    "    .#------@-------@. @@@@@@@.            .:-----+...@@@@*@@             .@---------@-----@..      ",
    "     .@-----*-------@. @@@@-.@..           .=------%..@@@@-@:             .@----------=--@-         ",
    "     . =@--@--------%...@@@@@..            .@------%.. .@@#..            .%-----------@=...         ",
    "        ..:----------@.........           .@--------@.                  .@-------------:. .         ",
    "         .@-----------@..               ..@-----%%%---@..             .#%--------------@...         ",
    "        ..@-------------@... .        ..@---+@@@@@@@@@--@@...  .....@@-----------------@. .         ",
    "        ..-----------------@@......:@@------@@@@@@@@@@#----------------------------------.          ",
    "        .%-------------------------------%::+@@@@@@@@:::%-------------------------------@..         ",
    "        .@------------------------------%:::::::::::::::::%-----------------------------@.          ",
    "        .@-----------------------------*:::::::::::::::::::@----------------------------@..         ",
    "        .@------------------------------@:::::.@%%%%::::::%-----------------------------#.          ",
    "       ..@-------------------------------:*@....#-....#%%=-------------------------------:.         ",
    "         @---------------------------------=.. .@.. ..#----------------------------------=.         ",
    "        .@---------------------------------@..  @..  .%----------------------------------+.         ",
    "        .@---------------------------------+:...@@.. .*----------------------------------#          ",
    "        .*----------------------------------------=@-------------------------------------%          ",
    "          .------------------------------------------------------------------------------@.  .      ",
    "    ..@@%===-----------------------------------------------------------------------------@::-@@...  ",
    "  .@:::::::+-----------------------------------------------------------------------------@::::::@.. ",
    " .%::::::::=-----------------------------------------------------------------------------@:::::::@. ",
    " .@@-:::::@------------------------------------------------------------------------------#%:::::@.. ",
    "...@::=@..-------------------------------------------------------------------------------+..#@%@=...",
    " .  ...   #-------------------------------------------------------------------------------:   ...   ",
    "",
    "",
}

local buttons = {
    { txt = "  Find File", keys = "<leader>ff", cmd = "FzfLua files" },
    { txt = "󰈚  Recent Files", keys = "<leader>fr", cmd = "FzfLua oldfiles" },
    { txt = "󰈭  Live Grep", keys = "<leader>fg", cmd = "FzfLua live_grep" },
    { txt = "  Search Help", keys = "<leader>fh", cmd = "Search docs" },
}

---@param keys string[]
---@param rhs string|function
---@param buf number
local keymap = function(keys, rhs, buf)
    for _, k in ipairs(keys) do
        vim.keymap.set("n", k, rhs, { buffer = buf })
    end
end

---@param txt1 string
---@param txt2 string
---@param max_str_w number
local function spaced_button(txt1, txt2, max_str_w)
    local button_len = vim.api.nvim_strwidth(txt1) + #txt2
    local spacing = max_str_w - button_len
    return txt1 .. string.rep(" ", spacing) .. txt2
end

---@param buf? integer
---@param win? integer
---@param action? string "open"|"redraw"
M.open = function(buf, win, action)
    action = action or "open"
    win = win or vim.api.nvim_get_current_win()

    if not vim.bo.buflisted and action == "open" then
        if vim.t.bufs[1] then
            win = vim.fn.bufwinid(vim.t.bufs[1])
            vim.api.nvim_set_current_win(win)
        end
    end

    local ns = vim.api.nvim_create_namespace "cc/dashboard"
    local winh = vim.api.nvim_win_get_height(win)
    local winw = vim.api.nvim_win_get_width(win)
    buf = buf or vim.api.nvim_create_buf(false, true)

    vim.g.dash_buf = buf
    vim.g.dash_win = win

    if action == "open" then
        vim.api.nvim_win_set_buf(0, buf)
    end

    local ui = {}

    -- Find the largest string width:
    local max_w = 0
    for _, v in ipairs(header) do
        local headerw = vim.api.nvim_strwidth(v)
        if headerw > max_w then
            max_w = headerw
        end
        local col = math.floor((winw / 2) - math.floor(vim.api.nvim_strwidth(v) / 2)) - 6
        local opt = { virt_text_win_col = col, virt_text = { { v, "NvDashAscii" } } }
        table.insert(ui, opt)
    end

    -- Find the largest button width:
    for _, v in ipairs(buttons) do
        local w = vim.api.nvim_strwidth(v.txt)
        if max_w < w then
            max_w = w
        end
    end

    -- Create the buttons:
    local button_lines = {}
    for _, v in ipairs(buttons) do
        local w = max_w
        local col, opt

        local str = spaced_button(v.txt, v.keys, w)
        col = math.floor((winw / 2) - math.floor(w / 2)) - 6
        opt = { virt_text_win_col = col, virt_text = { { str, "NvDashButtons" } } }

        table.insert(ui, opt)
        table.insert(button_lines, { i = #ui, cmd = v.cmd, col = col })
        table.insert(ui, { virt_text = { { "" } } })

        keymap({ v.keys }, "<cmd>" .. v.cmd .. "<cr>", buf)
    end

    -- Save the display text:
    local dashboard_h = #ui + 3
    winh = dashboard_h > winh and dashboard_h or winh
    local row_i = math.floor((winh / 2) - (dashboard_h / 2))

    for i, v in ipairs(button_lines) do
        button_lines[i].i = v.i + row_i + 1
    end

    local empty_str = {}
    for i = 1, winh do
        empty_str[i] = ""
    end

    -- Set the text and extmarks:
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, empty_str)
    for i, v in ipairs(ui) do
        vim.api.nvim_buf_set_extmark(buf, ns, row_i + i, 0, v)
    end

    if action == "redraw" then
        return
    end

    -- Keybind setup:
    vim.wo[win].virtualedit = "all"
    vim.api.nvim_win_set_cursor(win, { button_lines[1].i, button_lines[1].col })

    ---@param n integer
    ---@param cmd boolean
    local key_movements = function(n, cmd)
        local curline = vim.fn.line "."

        for i, v in ipairs(button_lines) do
            if v.i == curline then
                local x = button_lines[i + n] or button_lines[n == 1 and 1 or #button_lines]
                if cmd and x.cmd then
                    vim.cmd(x.cmd)
                else
                    return { x.i, x.col }
                end
            end
        end
    end

    keymap({ "k", "<up>" }, function()
        vim.api.nvim_win_set_cursor(win, key_movements(-1, false))
    end, buf)

    keymap({ "j", "<down>" }, function()
        vim.api.nvim_win_set_cursor(win, key_movements(1, false))
    end, buf)

    keymap({ "<cr>" }, function()
        key_movements(0, true)
    end, buf)

    -- Buffer options:
    vim.api.nvim_set_option_value("buflisted", false, { buf = buf })
    vim.api.nvim_set_option_value("modifiable", false, { buf = buf })
    vim.api.nvim_set_option_value("buftype", "nofile", { buf = buf })
    vim.api.nvim_set_option_value("number", false, { scope = "local" })
    vim.api.nvim_set_option_value("list", false, { scope = "local" })
    vim.api.nvim_set_option_value("wrap", false, { scope = "local" })
    vim.api.nvim_set_option_value("relativenumber", false, { scope = "local" })
    vim.api.nvim_set_option_value("cursorline", false, { scope = "local" })
    vim.api.nvim_set_option_value("colorcolumn", "0", { scope = "local" })
    vim.api.nvim_set_option_value("foldcolumn", "0", { scope = "local" })
    vim.api.nvim_set_option_value("ft", "dashboard", { buf = buf })

    -- Auto commands:
    local augroup_name = "cc/dashboard"
    local group_id = vim.api.nvim_create_augroup(augroup_name, { clear = true })

    vim.api.nvim_create_autocmd("BufWinLeave", {
        group = group_id,
        buffer = buf,
        callback = function()
            vim.api.nvim_del_augroup_by_name(augroup_name)
        end,
    })

    vim.api.nvim_create_autocmd({ "WinResized", "VimResized" }, {
        group = group_id,
        callback = function()
            vim.bo[vim.g.dash_buf].ma = true
            M.open(vim.g.dash_buf, vim.g.dash_win, "redraw")
        end,
    })
end

-- Load dashboard only when not opening a file/directory directly.
-- Scheduling this because idk NvDash does that so I guess we should too.
vim.schedule(function()
    local opening_file = vim.api.nvim_buf_get_name(0)
    local is_dir = vim.fn.isdirectory(opening_file) == 1
    local bufmodifed = vim.api.nvim_get_option_value("modified", { buf = 0 })

    if not bufmodifed and (is_dir or opening_file == "") then
        local current_buffer = vim.api.nvim_get_current_buf()
        M.open()
        vim.api.nvim_buf_delete(current_buffer, { force = true, unload = false })
    end
end)

return M
