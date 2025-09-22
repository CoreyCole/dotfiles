-- Pretty bufferline.
return {
    {
        "akinsho/bufferline.nvim",
        event = "VeryLazy",
        opts = function()
            return {
                options = {
                    custom_filter = function(buf_number, buf_numbers)
                        -- Filter out buffers with no name
                        if vim.fn.bufname(buf_number) == "" then
                            return false
                        end
                        return true
                    end,
                    offsets = {
                        {
                            filetype = "NvimTree",
                            text = "File Explorer",
                            text_align = "center",
                            separator = true,
                        },
                    },
                    style_preset = require("bufferline").style_preset.no_italic,
                    show_close_icon = true,
                    show_buffer_close_icons = true,
                    truncate_names = false,
                    indicator = { style = "underline" },
                    diagnostics = "nvim_lsp",
                    diagnostics_indicator = function(_, _, diag)
                        local icons = require("icons").diagnostics
                        local indicator = (diag.error and icons.ERROR .. " " or "")
                            .. (diag.warning and icons.WARN or "")
                        return vim.trim(indicator)
                    end,
                },
            }
        end,
        keys = {
            -- Buffer navigation.
            { "<leader>bp", "<cmd>BufferLinePick<cr>", desc = "Pick a buffer to open" },
            { "<leader>bc", "<cmd>BufferLinePickClose<cr>", desc = "Select a buffer to close" },
            { "<leader>bl", "<cmd>BufferLineCloseLeft<cr>", desc = "Close buffers to the left" },
            { "<leader>br", "<cmd>BufferLineCloseRight<cr>", desc = "Close buffers to the right" },
            { "<leader>bo", "<cmd>BufferLineCloseOthers<cr>", desc = "Close other buffers" },
            { "<leader>wo", "<cmd>BufferLineCloseOthers<cr>", desc = "Close other buffers" },
            { "<Tab>", "<cmd>BufferLineCycleNext<cr>", desc = "Cycle to the next buffer" },
            { "<S-Tab>", "<cmd>BufferLineCyclePrev<cr>", desc = "Cycle to the previous buffer" },
            { "<leader>wq", "<cmd>bd<cr>", desc = "Close current buffer" },
        },
    },
}
