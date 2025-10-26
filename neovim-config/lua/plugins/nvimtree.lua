return {
    "nvim-tree/nvim-tree.lua",
    event = "VeryLazy",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = function()
        return {
            filters = {
                git_ignored = false,
                dotfiles = false,
                -- Custom list of vim regex for file/directory names that will not be shown.
                custom = { "node_modules", ".tmp", "*_templ.go" },
                -- exclude = { vim.fn.stdpath "config" .. "/lua/custom" },
            },
            disable_netrw = true,
            hijack_netrw = true,
            hijack_cursor = true,
            hijack_unnamed_buffer_when_opening = false,
            sync_root_with_cwd = true,
            update_focused_file = {
                enable = true,
                update_root = {
                    enable = false,
                },
                exclude = function(event)
                    return vim.api.nvim_buf_get_option(event.buf, "filetype") == "gitcommit"
                        or vim.fn.expand("%"):match "migrations"
                end,
            },
            view = {
                adaptive_size = false,
                side = "left",
                width = 40,
                preserve_window_proportions = true,
            },
            diagnostics = {
                enable = true,
            },
            git = {
                enable = false,
                ignore = true,
            },
            filesystem_watchers = {
                enable = true,
            },
            actions = {
                open_file = {
                    resize_window = true,
                },
            },
            renderer = {
                root_folder_label = false,
                highlight_git = true,
                highlight_opened_files = "all",

                indent_markers = {
                    enable = false,
                },

                icons = {
                    show = {
                        file = true,
                        folder = true,
                        folder_arrow = false,
                        git = true,
                    },

                    glyphs = {
                        default = "󰈚",
                        symlink = "",
                        folder = {
                            default = "",
                            empty = "",
                            empty_open = "",
                            open = "",
                            symlink = "",
                            symlink_open = "",
                            arrow_open = "",
                            arrow_closed = "",
                        },
                        git = {
                            unstaged = "✗",
                            staged = "✓",
                            unmerged = "",
                            renamed = "➜",
                            untracked = "★",
                            deleted = "",
                            ignored = "◌",
                        },
                    },
                },
            },
        }
    end,
}
