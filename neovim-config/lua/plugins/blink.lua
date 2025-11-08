---@module "lazy"
---@type LazySpec
return {
    {
        "saghen/blink.cmp",
        dependencies = { "rafamadriz/friendly-snippets" },
        version = "1.*",
        event = { "InsertEnter", "CmdlineEnter" },
        config = function(_, opts)
            require("blink.cmp").setup(opts)

            -- Extend neovim's client capabilities with the completion ones.
            vim.lsp.config("*", { capabilities = require("blink.cmp").get_lsp_capabilities(nil, true) })
        end,

        ---@module 'blink.cmp'
        ---@type blink.cmp.Config
        opts = {
            appearance = {
                use_nvim_cmp_as_default = false,
                nerd_font_variant = "normal",
            },
            -- cmdline = {
            --     keymap = { preset = "inherit" },
            --     completion = { menu = { auto_show = true } },
            -- },
            cmdline = { enabled = false },
            completion = {
                accept = { auto_brackets = { enabled = true } },
                documentation = {
                    auto_show = true,
                    auto_show_delay_ms = 250,
                    treesitter_highlighting = true,
                    update_delay_ms = 50,
                    window = { border = "rounded" },
                },
                list = {
                    selection = {
                        preselect = true,
                        auto_insert = false,
                    },
                },
                menu = {
                    border = "rounded",
                    draw = {
                        columns = {
                            { "label", "label_description", gap = 1 },
                            { "kind_icon", "kind" },
                        },
                        treesitter = { "lsp" },
                    },
                },
                trigger = { show_in_snippet = false },
            },

            keymap = {
                preset = "super-tab",
            },

            signature = {
                enabled = true,
                window = { border = "rounded", show_documentation = false },
            },

            sources = {
                default = { "lazydev", "lsp", "path", "snippets", "buffer" },
                providers = {
                    lazydev = {
                        name = "LazyDev",
                        module = "lazydev.integrations.blink",
                        -- Make lazydev completions top priority (see `:h blink.cmp`)
                        score_offset = 1000,
                    },
                    lsp = {
                        min_keyword_length = 2,
                        score_offset = 0,
                    },
                    path = {
                        min_keyword_length = 0,
                    },
                    snippets = {
                        min_keyword_length = 2,
                    },
                    buffer = {
                        min_keyword_length = 4,
                        max_items = 5,
                    },
                },
            },
        },
    },
}

-- Auto-completion:
-- return {
--     {
--         "saghen/blink.cmp",
--         dependencies = {
--             "LuaSnip",
--             "saghen/blink.compat",
--         },
--         build = "cargo +nightly build --release",
--         event = "InsertEnter",
--         opts = {
--             keymap = {
--                 ["<CR>"] = { "accept", "fallback" },
--                 ["<C-\\>"] = { "hide", "fallback" },
--                 ["<C-n>"] = { "select_next", "show" },
--                 ["<Tab>"] = { "select_next", "snippet_forward", "fallback" },
--                 ["<C-p>"] = { "select_prev" },
--                 ["<C-b>"] = { "scroll_documentation_up", "fallback" },
--                 ["<C-f>"] = { "scroll_documentation_down", "fallback" },
--             },
--             completion = {
--                 list = {
--                     -- Insert items while navigating the completion list.
--                     selection = { preselect = false, auto_insert = true },
--                     max_items = 10,
--                 },
--                 documentation = { auto_show = true },
--                 menu = { scrollbar = false },
--             },
--             snippets = { preset = "luasnip" },
--             -- Disable command line completion:
--             cmdline = { enabled = false },
--             sources = {
--                 -- Disable some sources in comments and strings.
--                 default = function()
--                     local sources = { "lsp", "buffer" }
--                     local ok, node = pcall(vim.treesitter.get_node)
--
--                     if ok and node then
--                         if not vim.tbl_contains({ "comment", "line_comment", "block_comment" }, node:type()) then
--                             table.insert(sources, "path")
--                         end
--                         if node:type() ~= "string" then
--                             table.insert(sources, "snippets")
--                         end
--                     end
--
--                     return sources
--                 end,
--                 per_filetype = {
--                     codecompanion = { "codecompanion", "buffer" },
--                     toml = { "crates", "lsp", "buffer", "path" },
--                 },
--                 providers = {
--                     crates = {
--                         name = "crates",
--                         module = "blink.compat.source",
--                     },
--                 },
--             },
--             appearance = {
--                 kind_icons = require("icons").symbol_kinds,
--             },
--         },
--         config = function(_, opts)
--             require("blink.cmp").setup(opts)
--
--             -- Extend neovim's client capabilities with the completion ones.
--             vim.lsp.config("*", { capabilities = require("blink.cmp").get_lsp_capabilities(nil, true) })
--         end,
--     },
-- }
