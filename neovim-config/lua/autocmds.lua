-- Autocmds are automatically loaded on the VeryLazy event
-- Docs: https://www.lazyvim.org/configuration/general
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
-- Add any additional autocmds here

-- Auto-focus window on mouse scroll to make scrollbind work properly in diffview
vim.api.nvim_create_autocmd("WinScrolled", {
    callback = function()
        local current_buf_name = vim.api.nvim_buf_get_name(0)
        local current_win = vim.api.nvim_get_current_win()
        local mouse_win = vim.fn.getmousepos().winid

        -- Check if we're in a diffview context (either current window is diffview:// or has diff mode)
        local in_diff_context = current_buf_name:match "^diffview://"
            or vim.api.nvim_win_get_option(current_win, "diff")

        if in_diff_context then
            if mouse_win > 0 and vim.api.nvim_win_is_valid(mouse_win) then
                local mouse_buf = vim.api.nvim_win_get_buf(mouse_win)
                local mouse_buf_name = vim.api.nvim_buf_get_name(mouse_buf)

                -- Check if mouse is over a diff window (either diffview:// URL or a regular file in diff mode)
                -- Exclude the file panel
                if not mouse_buf_name:match "/panels/" then
                    -- Check if it's a diffview buffer or if the window has diff mode enabled
                    local is_diff_window = mouse_buf_name:match "^diffview://"
                        or vim.api.nvim_win_get_option(mouse_win, "diff")

                    if is_diff_window then
                        vim.api.nvim_set_current_win(mouse_win)
                    end
                end
            end
        end
    end,
})

local function find_python_executable()
    if vim.env.VIRTUAL_ENV then
        local paths = vim.fn.glob(vim.env.VIRTUAL_ENV .. "/**/bin/python", true, true)
        local executable_path = table.concat(paths, ", ")
        if executable_path ~= "" then
            vim.api.nvim_echo({ { "Using path for python: " .. executable_path, "None" } }, false, {})
            return executable_path
        end
    elseif vim.fn.filereadable ".venv/bin/python" == 1 then
        local executable_path = vim.fn.expand ".venv/bin/python"
        vim.api.nvim_echo({ { "Using path for python: " .. executable_path, "None" } }, false, {})
        return executable_path
    end
    vim.api.nvim_echo({ { "No python executable found (see autocmds.lua)", "WarningMsg" } }, false, {})
end

vim.api.nvim_create_autocmd("FileType", {
    pattern = { "python" },
    callback = function()
        vim.g.python3_host_prog = find_python_executable() -- python executable
        vim.opt_local.colorcolumn = "72,88" -- Ruler at column number
        vim.opt_local.tabstop = 4 -- Number of spaces tabs count for
        vim.opt_local.shiftwidth = 4 -- Size of an indent
    end,
})

vim.api.nvim_create_autocmd("FileType", {
    pattern = { "go" },
    callback = function()
        vim.opt_local.colorcolumn = "120" -- Ruler at column number
    end,
})

vim.api.nvim_create_autocmd("FileType", {
    pattern = { "rust" },
    callback = function()
        vim.opt_local.colorcolumn = "79" -- Ruler at column number
        vim.opt_local.tabstop = 4 -- Number of spaces tabs count for
        vim.opt_local.shiftwidth = 4 -- Size of an indent
    end,
})

vim.api.nvim_create_autocmd("FileType", {
    pattern = "typescript",
    callback = function()
        vim.opt_local.colorcolumn = "79" -- Ruler at column number
        vim.opt_local.tabstop = 4
        vim.opt_local.shiftwidth = 4
    end,
})

vim.api.nvim_create_autocmd("FileType", {
    pattern = "markdown",
    callback = function()
        vim.opt_local.tabstop = 2
        vim.opt_local.shiftwidth = 2
        vim.opt_local.expandtab = false
    end,
})
