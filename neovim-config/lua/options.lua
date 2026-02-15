require "nvchad.options"
local arrows = require("icons").arrows

vim.o.linebreak = true
vim.o.cmdheight = 1
vim.o.laststatus = 3

-- ufo options
vim.opt.fillchars = {
    eob = " ",
    fold = " ",
    foldclose = arrows.right,
    foldopen = arrows.down,
    foldinner = " ",
    foldsep = " ",
    msgsep = "─",
}
vim.o.foldlevel = 99
vim.o.foldlevelstart = 99
vim.o.foldcolumn = "1"

-- Add diagonal lines for diff deletions
vim.opt.fillchars:append { diff = "╱" }

-- Auto-read files when changed externally
vim.opt.autoread = true

-- Check for file changes more frequently
vim.opt.updatetime = 100

-- Trigger checktime on various events to watch for file changes
vim.api.nvim_create_autocmd({ "FocusGained", "BufEnter", "CursorHold", "CursorHoldI", "WinEnter", "TermResponse" }, {
    pattern = "*",
    command = "checktime",
})
vim.opt.swapfile = false

vim.api.nvim_set_hl(0, "NeogitDiffDelete", { fg = "#D14242" })
vim.api.nvim_set_hl(0, "NeogitDiffAdd", { fg = "#559955" })
vim.api.nvim_set_hl(0, "NeogitDiffDeleteHighlight", { fg = "#D14242" })
vim.api.nvim_set_hl(0, "NeogitDiffAddHighlight", { fg = "#559955" })

-- Standard diff highlight groups (for regular diffs outside Neogit)
vim.api.nvim_set_hl(0, "DiffAdd", { bg = "#2a3d2a" })
vim.api.nvim_set_hl(0, "DiffDelete", { bg = "#3d2a2a" })
vim.api.nvim_set_hl(0, "DiffChange", { bg = "#3d3d2a" })
vim.api.nvim_set_hl(0, "DiffText", { bg = "#4d4d2a", bold = true })

-- Diffview.nvim highlight groups (with enhanced_diff_hl enabled)
-- Left side deletions (shows what was removed)
vim.api.nvim_set_hl(0, "DiffviewDiffAddAsDelete", { bg = "#3d2828", fg = "#e88388" })
vim.api.nvim_set_hl(0, "DiffviewDiffDelete", { fg = "#6c5b5f" })

-- Right side additions (shows what was added)
vim.api.nvim_set_hl(0, "DiffviewDiffAdd", { bg = "#2a3d2a" })

-- Changes (modifications)
vim.api.nvim_set_hl(0, "DiffviewDiffChange", { bg = "#3d3d2a" })
vim.api.nvim_set_hl(0, "DiffviewDiffText", { bg = "#5f5f3a", bold = true, italic = true })

-- Style for deletion placeholder lines (the diagonal lines)
vim.api.nvim_set_hl(0, "DiffviewDim1", { fg = "#585b70" })
vim.api.nvim_set_hl(0, "DiffviewFillChar", { fg = "#45475a" })

vim.cmd "map <S-Down> <Nop>"
vim.cmd "map <S-Up> <Nop>"
-- local o = vim.o
-- o.cursorlineopt ='both' -- to enable cursorline!
vim.opt.listchars = "tab:▸ ,trail:·,nbsp:␣,extends:❯,precedes:❮" -- show symbols for whitespace
vim.opt.relativenumber = false -- relative line numbers
-- vim.opt.scrolloff = 10 -- keep 20 lines above and below the cursor

vim.g.copilot_no_tab_map = true
vim.g.copilot_assume_mapped = true
vim.g.copilot_tab_fallback = ""
vim.opt.listchars = "tab:▸ ,trail:·,nbsp:␣,extends:❯,precedes:❮" -- show symbols for whitespace
vim.opt.relativenumber = false -- relative line numbers
-- vim.opt.scrolloff = 10 -- keep 20 lines above and below the cursor

-- clipboard provider must be set before vim.opt.clipboard
if vim.fn.has "wsl" == 1 then
    vim.api.nvim_create_autocmd("TextYankPost", {

        group = vim.api.nvim_create_augroup("Yank", { clear = true }),

        callback = function()
            vim.fn.system("clip.exe", vim.fn.getreg '"')
        end,
    })
elseif vim.fn.has "linux" == 1 and (vim.env.DISPLAY or "") == "" and (vim.env.WAYLAND_DISPLAY or "") == "" then
    -- headless linux (e.g. Ubuntu Server over SSH) - use OSC 52 terminal clipboard
    vim.g.clipboard = "osc52"
end
-- sync with system clipboard
vim.opt.clipboard = "unnamedplus"

vim.g.is_code_private = function()
    local current_dir = vim.fn.getcwd()
    local home_dir = os.getenv "HOME" or os.getenv "USERPROFILE"

    -- if git repo is filed under ~/private, do not allow AI
    local private_path = home_dir .. "/private"
    local is_code_private = string.find(current_dir, private_path) == 1

    if is_code_private then
        return true
    else
        return false
    end
end

-- Diagnostic configuration.
local diagnostic_icons = require("icons").diagnostics
vim.diagnostic.config {
    virtual_text = {
        prefix = "",
        spacing = 2,
        format = function(diagnostic)
            -- Use shorter, nicer names for some sources:
            local special_sources = {
                ["Lua Diagnostics."] = "lua",
                ["Lua Syntax Check."] = "lua",
            }

            local message = diagnostic_icons[vim.diagnostic.severity[diagnostic.severity]]
            if diagnostic.source then
                message = string.format("%s %s", message, special_sources[diagnostic.source] or diagnostic.source)
            end
            if diagnostic.code then
                message = string.format("%s[%s]", message, diagnostic.code)
            end

            return message .. " "
        end,
    },
    float = {
        source = "if_many",
        -- Show severity icons as prefixes.
        prefix = function(diag)
            local level = vim.diagnostic.severity[diag.severity]
            local prefix = string.format(" %s ", diagnostic_icons[level])
            return prefix, "Diagnostic" .. level:gsub("^%l", string.upper)
        end,
    },
}

-- Disable cursor blinking in terminal mode.
vim.o.guicursor = "n-v-c-sm:block,i-ci-ve:ver25,r-cr-o:hor20,t:block-TermCursor"
