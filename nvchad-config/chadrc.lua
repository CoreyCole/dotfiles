--@type ChadrcConfig
local M = {}

-- require "custom.autocmds"
M.ui = {
  theme = "vscode_dark",
  changed_themes = {
    vscode_dark = {
      base_16 = {
        base00 = "#000000",
        base01 = "#262626",
        base02 = "#303030",
        base03 = "#3C3C3C",
        base04 = "#464646",
        base05 = "#D4D4D4",
        base06 = "#E9E9E9",
        base07 = "#FFFFFF",
        base08 = "#D16969",
        base09 = "#B5CEA8",
        base0A = "#D7BA7D",
        base0B = "#BD8D78",
        base0C = "#9CDCFE",
        base0D = "#DCDCAA",
        base0E = "#C586C0",
        base0F = "#E9E9E9",
      },
      base_30 = {
        white = "#dee1e6",
        darker_black = "#000000",
        black = "#000000", --  nvim bg
        black2 = "#000000",
        one_bg = "#282828",
        one_bg2 = "#313131",
        one_bg3 = "#3a3a3a",
        grey = "#444444",
        grey_fg = "#4e4e4e",
        grey_fg2 = "#585858",
        light_grey = "#626262",
        red = "#D16969",
        baby_pink = "#ea696f",
        pink = "#bb7cb6",
        line = "#2e2e2e", -- for lines like vertsplit
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
        folder_bg = "#7A8A92",
      },
    }
  },
  statusline = {
    theme = "vscode",
    overriden_modules = function(modules)
      table.insert(
        modules,
        3,
        (function()
          return "(" .. vim.fn.expand('%:p:h:t') .. ")"
        end)()
      )
    end,
  },
}
M.plugins = "custom.plugins"
M.mappings = require "custom.mappings"

return M
