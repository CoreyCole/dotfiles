return {
    "nvim-treesitter/nvim-treesitter",
    cmd = { "TSInstall", "TSBufEnable", "TSBufDisable", "TSModuleInfo" },
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
    opts = function()
        return {
            ensure_installed = {
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
            },
            auto_install = false,
            highlight = {
                enable = true,
                use_languagetree = true,
            },
            indent = { enable = true },
            autotag = { enable = true },
            context_commentstring = {
                enable = true,
                config = {
                    javascript = {
                        __default = "// %s",
                        jsx_element = "{/* %s */}",
                        jsx_fragment = "{/* %s */}",
                        jsx_attribute = "// %s",
                        comment = "// %s",
                    },
                    sql = {
                        __default = "-- %s",
                    },
                },
            },
        }
    end,
    config = function(_, opts)
        dofile(vim.g.base46_cache .. "syntax")
        require("nvim-treesitter.configs").setup(opts)
    end,
}
