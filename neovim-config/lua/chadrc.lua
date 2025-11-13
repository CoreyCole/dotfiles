local options = {
    base46 = {
        theme = "onedark",
        hl_add = {},
        hl_override = {},
        integrations = {},
        changed_themes = {
            onedark = {
                base_16 = {
                    base00 = "#000000",
                    base01 = "#2c333a",
                    base02 = "#31383f",
                    base03 = "#40474e",
                    base04 = "#4f565d",
                    base05 = "#ced4df",
                    base06 = "#d3d9e4",
                    base07 = "#b5bcc9",
                    base08 = "#ef8891",
                    base09 = "#EDA685",
                    base0A = "#a3b8ef",
                    base0B = "#BD8D78",
                    base0C = "#abb9e0",
                    base0D = "#D16969",
                    base0E = "#C586C0",
                    base0F = "#e88e9b",
                },
                base_30 = {
                    white = "#dee1e6",
                    darker_black = "#000000", -- non code bg
                    black = "#101010", -- active fil in nvim tree bg
                    black2 = "#000000", -- tab and bottom bg
                    one_bg = "#282828",
                    one_bg2 = "#000000", -- mode / dir bg
                    one_bg3 = "#000000", -- light/dark toggle bg
                    grey = "#707070", -- line numbers
                    grey_fg = "#909090", -- comments
                    grey_fg2 = "#585858",
                    light_grey = "#727272", -- non-active tab text
                    red = "#D16969",
                    baby_pink = "#ea696f",
                    pink = "#bb7cb6",
                    line = "#111111", -- for lines like vertsplit
                    green = "#B5CEA8",
                    green1 = "#4EC994",
                    vibrant_green = "#bfd8b2",
                    blue = "#569CD6",
                    nord_blue = "#60a6e0",
                    yellow = "#D7BA7D",
                    sun = "#e1c487",
                    purple = "#c68aee",
                    dark_purple = "#b77bdf",
                    teal = "#4294D6",
                    orange = "#d3967d",
                    cyan = "#9CDCFE",
                    statusline_bg = "#000000",
                    lightbg = "#303030",
                    pmenu_bg = "#60a6e0",
                    folder_bg = "#707070", -- folder text color
                },

                -- base_30 = {
                --   white = "#dee1e6",
                --   darker_black = "#070707", -- filetree bg
                --   black = "#000000", --  tabs bg
                --   black2 = "#000000", -- tabs bg bg
                --   one_bg = "#282828",
                --   one_bg2 = "#313131",
                --   one_bg3 = "#3a3a3a",
                --   grey = "#444444",
                --   grey_fg = "#4e4e4e",
                --   grey_fg2 = "#585858",
                --   light_grey = "#626262",
                --   red = "#D16969",
                --   baby_pink = "#ea696f",
                --   pink = "#bb7cb6",
                --   line = "#2e2e2e", -- for lines like vertsplit
                --   green = "#B5CEA8",
                --   green1 = "#4EC994",
                --   vibrant_green = "#bfd8b2",
                --   blue = "#569CD6",
                --   nord_blue = "#60a6e0",
                --   yellow = "#D7BA7D",
                --   sun = "#e1c487",
                --   purple = "#c68aee",
                --   dark_purple = "#b77bdf",
                --   teal = "#4294D6",
                --   orange = "#d3967d",
                --   cyan = "#9CDCFE",
                --   statusline_bg = "#000000",
                --   lightbg = "#303030",
                --   pmenu_bg = "#60a6e0",
                --   folder_bg = "#7A8A92",
                -- },
            },
        },

        transparency = false,
        -- theme_toggle = { "onedark", "one_light" },
    },

    ui = {
        cmp = {
            icons = true,
            lspkind_text = true,
            style = "default", -- default/flat_light/flat_dark/atom/atom_colored
        },

        telescope = { style = "borderless" }, -- borderless / bordered

        statusline = {
            enabled = false,
            theme = "vscode",
            order = {
                "mode",
                "cursor",
                "diagnostics",
                "lsp_msg",

                "%=",
                "file",
                "dir",
                "%=",
                "git",
                "%=",

                "lsp",
                "cwd",
            },
            modules = {
                -- show open file's directory
                dir = function()
                    return "("
                        -- Get the parent directory's parent directory's parent directory name (3 levels up)
                        .. vim.fn.fnamemodify(vim.fn.expand "%:p:h", ":h:h:t")
                        .. "/"
                        -- Get the parent directory's parent directory name (2 levels up)
                        .. vim.fn.fnamemodify(vim.fn.expand "%:p:h", ":h:t")
                        .. "/"
                        -- Get the parent directory name (1 level up)
                        .. vim.fn.expand "%:p:h:t"
                        .. ")"
                end,
            },
        },

        -- lazyload it when there are 1+ buffers
        tabufline = {
            enabled = false,
            lazyload = false,
            bufwidth = 35,
            order = { "treeOffset", "buffers", "tabs", "btns" },
            modules = nil,
        },
    },

    term = {
        enabled = false,
        winopts = { number = false, relativenumber = false },
        sizes = { sp = 0.3, vsp = 0.2, ["bo sp"] = 0.3, ["bo vsp"] = 0.2 },
        float = {
            relative = "editor",
            row = 0.3,
            col = 0.25,
            width = 0.5,
            height = 0.4,
            border = "single",
        },
    },

    lsp = { signature = true },

    cheatsheet = {
        theme = "grid", -- simple/grid
        excluded_groups = { "terminal (t)", "autopairs", "Nvim", "Opens" }, -- can add group name or with mode
    },

    mason = { cmd = true, pkgs = {} },
}

local status, chadrc = pcall(require, "chadrc")
return vim.tbl_deep_extend("force", options, status and chadrc or {})

--@type ChdrcConfig
-- local M = {}
--
-- M.ui = {
-- statusline = {
--   theme = "vscode",
--   order = {
--     "mode",
--     "file",
--     "dir",
--     "diagnostics",
--     "git",
--     "%=",
--     "lsp_msg",
--     "%=",
--     "lsp",
--     "cursor",
--     "cwd",
--   },
--   modules = {
--     -- show open file's directory
--     dir = function()
--       return "(" .. vim.fn.expand "%:p:h:t" .. ")"
--     end,
--   },
-- },
--   theme = "vscode_dark",
-- changed_themes = {
--   vscode_dark = {
--     base_16 = {
--       base00 = "#000000",
--       base01 = "#262626",
--       base02 = "#303030",
--       base03 = "#3C3C3C",
--       base04 = "#464646",
--       base05 = "#D4D4D4",
--       base06 = "#E9E9E9",
--       base07 = "#FFFFFF",
--       base08 = "#D16969",
--       base09 = "#B5CEA8",
--       base0A = "#a16969",
--       base0B = "#BD8D78",
--       base0C = "#ffffff",
--       base0D = "#DCDCAA",
--       base0E = "#C586C0",
--       base0F = "#E9E9E9",
--     },
--     base_30 = {
--       white = "#dee1e6",
--       darker_black = "#070707", -- filetree bg
--       black = "#000000", --  tabs bg
--       black2 = "#000000", -- tabs bg bg
--       one_bg = "#282828",
--       one_bg2 = "#313131",
--       one_bg3 = "#3a3a3a",
--       grey = "#444444",
--       grey_fg = "#4e4e4e",
--       grey_fg2 = "#585858",
--       light_grey = "#626262",
--       red = "#D16969",
--       baby_pink = "#ea696f",
--       pink = "#bb7cb6",
--       line = "#2e2e2e", -- for lines like vertsplit
--       green = "#B5CEA8",
--       green1 = "#4EC994",
--       vibrant_green = "#bfd8b2",
--       blue = "#569CD6",
--       nord_blue = "#60a6e0",
--       yellow = "#D7BA7D",
--       sun = "#e1c487",
--       purple = "#c68aee",
--       dark_purple = "#b77bdf",
--       teal = "#4294D6",
--       orange = "#d3967d",
--       cyan = "#9CDCFE",
--       statusline_bg = "#000000",
--       lightbg = "#303030",
--       pmenu_bg = "#60a6e0",
--       folder_bg = "#7A8A92",
--     },
--   },
-- },
-- }
--
-- M.ui.changed_themes.vscode_dark.polish_hl = {
--   ["@variable.parameter"] = { fg = M.ui.changed_themes.vscode_dark.base_30.white },
--   ["@keyword"] = { fg = M.ui.changed_themes.vscode_dark.base_30.red },
--   ["@variable"] = { fg = M.ui.changed_themes.vscode_dark.base_30.white },
--   ["@variable.member.key"] = { fg = M.ui.changed_themes.vscode_dark.base_30.white },
--   ["@keyword.return"] = { fg = M.ui.changed_themes.vscode_dark.base_16.base0E },
--   ["@keyword.function"] = { fg = M.ui.changed_themes.vscode_dark.base_30.white },
-- }
--
-- -- M = require("base46").override_theme(M, "vscode_dark")
--
-- return M
