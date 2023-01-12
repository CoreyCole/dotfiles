local status, lualine = pcall(require, "lualine")
if (not status) then return end
local status, vscode = pcall(require, "vscode")
if (not status) then return end

local c = require("vscode.colors").get_colors()
vscode.setup({
    -- Enable transparent background
    transparent = true,

    -- Enable italic comment
    italic_comments = true,

    -- Disable nvim-tree background color
    disable_nvimtree_bg = true,

    -- Override colors (see ./lua/vscode/colors.lua)
    color_overrides = {vscLineNumber = "#A3A3A3"},

    -- Override highlight groups (see ./lua/vscode/theme.lua)
    group_overrides = {
        -- this supports the same val table as vim.api.nvim_set_hl
        -- use colors from this colorscheme by requiring vscode.colors!
        Cursor = {fg = c.vscDarkBlue, bg = c.vscLightGreen, bold = true}
    }
})
lualine.setup {
    options = {
        icons_enabled = true,
        -- theme = "solarized_dark",
        theme = "vscode",
        section_separators = {left = "", right = ""},
        component_separators = {left = "", right = ""},
        disabled_filetypes = {"packer", "NvimTree"}
    },
    sections = {
        lualine_a = {"mode"},
        lualine_b = {"branch"},
        lualine_c = {
            {
                "filename",
                file_status = true, -- displays file status (readonly status, modified status)
                path = 2 -- 0 = just filename, 1 = relative path, 2 = absolute path
            }
        },
        lualine_x = {
            {"diagnostics", sources = {"nvim_diagnostic"}, symbols = {error = " ", warn = " ", info = " ", hint = " "}},
            "encoding", "filetype"
        },
        lualine_y = {"progress"},
        lualine_z = {"location"}
    },
    inactive_sections = {
        lualine_a = {},
        lualine_b = {},
        lualine_c = {
            {
                "filename",
                file_status = true, -- displays file status (readonly status, modified status)
                path = 1 -- 0 = just filename, 1 = relative path, 2 = absolute path
            }
        },
        lualine_x = {"location"},
        lualine_y = {},
        lualine_z = {}
    },
    tabline = {}
    -- extensions = { "fugitive" }
}

