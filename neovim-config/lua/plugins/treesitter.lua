local languages = {
    "c",
    "lua",
    "vim",
    "vimdoc",
    "query",
    "go",
    "python",
    "html",
    "css",
    "typescript",
    "javascript",
    "tsx",
    "markdown",
    "markdown_inline",
    -- Common fenced code block languages in Markdown.
    "bash",
    "json",
    "yaml",
    "toml",
    "sql",
}

local filetypes = {
    "c",
    "lua",
    "vim",
    "vimdoc",
    "query",
    "go",
    "python",
    "html",
    "css",
    "typescript",
    "javascript",
    "typescriptreact",
    "javascriptreact",
    "markdown",
    "sh",
    "bash",
    "json",
    "yaml",
    "toml",
    "sql",
}

return {
    "nvim-treesitter/nvim-treesitter",
    -- The current nvim-treesitter main branch no longer supports lazy-loading
    -- or the old highlight.enable module. Start highlighting via FileType below.
    lazy = false,
    build = ":TSUpdate",
    dependencies = {
        "nvim-treesitter/nvim-treesitter-textobjects",
        {
            "nvim-treesitter/nvim-treesitter-context",
            dependencies = { "nvim-treesitter/nvim-treesitter" },
            event = "VeryLazy",
            opts = function()
                return {
                    enable = true, -- Enable this plugin (Can be enabled/disabled later via commands)
                    max_lines = 3, -- How many lines the window should span. Values <= 0 mean no limit.
                    min_window_height = 0, -- Minimum editor window height to enable context. Values <= 0 mean no limit.
                    line_numbers = true,
                    multiline_threshold = 20, -- Maximum number of lines to show for a single context
                    trim_scope = "outer", -- Which context lines to discard if `max_lines` is exceeded. Choices: 'inner', 'outer'
                    mode = "cursor", -- Line used to calculate context. Choices: 'cursor', 'topline'
                    -- Separator between context and content. Should be a single character string, like '-'.
                    -- When separator is set, the context will only show up when there are at least 2 lines above cursorline.
                    separator = nil,
                    zindex = 20, -- The Z-index of the context window
                    on_attach = nil, -- (fun(buf: integer): boolean) return false to disable attaching
                }
            end,
            config = function(_, opts)
                require("treesitter-context").setup(opts)
            end,
        },
    },
    config = function()
        dofile(vim.g.base46_cache .. "syntax")

        local treesitter = require "nvim-treesitter"
        treesitter.setup()
        treesitter.install(languages)

        vim.api.nvim_create_autocmd("FileType", {
            pattern = filetypes,
            callback = function(args)
                pcall(vim.treesitter.start, args.buf)
                vim.bo[args.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
            end,
        })
    end,
}
