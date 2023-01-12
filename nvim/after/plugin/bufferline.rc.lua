local status, bufferline = pcall(require, "bufferline")
if (not status) then return end

bufferline.setup({
    options = {
        buffer_close_icon = "",
        close_icon = "",
        -- indicator_icon = " ",
        left_trunc_marker = "",
        modified_icon = "●",
        offsets = {{filetype = "NvimTree", text = "SAUCE", text_align = "center"}},
        right_mouse_command = "Bdelete! %d",
        right_trunc_marker = "",
        show_close_icon = false,
        show_tab_indicators = true
    },
    highlights = {
        fill = {bg = "NONE"},
        background = {fg = {attribute = "fg", highlight = "Normal"}, bg = {attribute = "bg", highlight = "StatusLine"}},
        buffer_visible = {fg = {attribute = "fg", highlight = "Normal"}, bg = {attribute = "bg", highlight = "Normal"}},
        buffer_selected = {fg = {attribute = "fg", highlight = "Normal"}, bg = {attribute = "bg", highlight = "Normal"}},
        separator = {fg = {attribute = "bg", highlight = "Normal"}, bg = {attribute = "bg", highlight = "StatusLine"}},
        separator_selected = {fg = {attribute = "fg", highlight = "Special"}, bg = {attribute = "bg", highlight = "Normal"}},
        separator_visible = {fg = {attribute = "fg", highlight = "Normal"}, bg = {attribute = "bg", highlight = "StatusLineNC"}},
        close_button = {fg = {attribute = "fg", highlight = "Normal"}, bg = {attribute = "bg", highlight = "StatusLine"}},
        close_button_selected = {fg = {attribute = "fg", highlight = "normal"}, bg = {attribute = "bg", highlight = "normal"}},
        close_button_visible = {fg = {attribute = "fg", highlight = "normal"}, bg = {attribute = "bg", highlight = "normal"}}
    }
})
