vim.g.base46_cache = vim.fn.stdpath "data" .. "/nvchad/base46/"
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- bootstrap lazy and all plugins
local lazypath = vim.fn.stdpath "data" .. "/lazy/lazy.nvim"

if not vim.loop.fs_stat(lazypath) then
    local repo = "https://github.com/folke/lazy.nvim.git"
    vim.fn.system { "git", "clone", "--filter=blob:none", repo, "--branch=stable", lazypath }
end

vim.opt.rtp:prepend(lazypath)

-- load plugins
require("lazy").setup({
    {
        "NvChad/NvChad",
        lazy = false,
        branch = "v2.5",
        -- import = "nvchad.plugins",
        --        import "nvchad.plugins.nvdash",
        config = function() end,
    },

    { import = "plugins" },
}, {
    defaults = { lazy = true },
    install = { colorscheme = { "nvchad" } },
    change_detection = { notify = false },

    ui = {
        icons = {
            ft = "",
            lazy = "󰂠 ",
            loaded = "",
            not_loaded = "",
        },
    },

    performance = {
        rtp = {
            disabled_plugins = {
                "2html_plugin",
                "tohtml",
                "getscript",
                "getscriptPlugin",
                "gzip",
                "logipat",
                "netrw",
                "netrwPlugin",
                "netrwSettings",
                "netrwFileHandlers",
                "matchit",
                "tar",
                "tarPlugin",
                "rrhelper",
                "spellfile_plugin",
                "vimball",
                "vimballPlugin",
                "zip",
                "zipPlugin",
                "tutor",
                "rplugin",
                "syntax",
                "synmenu",
                "optwin",
                "compiler",
                "bugreport",
                "ftplugin",
            },
        },
    },
})

-- load theme
dofile(vim.g.base46_cache .. "defaults")
dofile(vim.g.base46_cache .. "statusline")

-- format on save
vim.api.nvim_create_autocmd("BufWritePre", {
    pattern = "*",
    callback = function(args)
        local bufnr = args.buf
        local filename = vim.api.nvim_buf_get_name(bufnr)

        if filename:match "_templ%.go$" then
            -- Skip conform formatting for _templ.go files
            return
        else
            require("conform").format { bufnr = args.buf }
        end
    end,
})

require "autocmds"
require "mappings"
require "statusline"
require "winbar"
require "dashboard"
require "lsp"
require "options"
require "nvchad.autocmds"
require "sqls.hover"
require("vim._core.ui2").enable {}
