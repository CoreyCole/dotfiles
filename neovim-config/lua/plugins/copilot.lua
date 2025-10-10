return {
    "zbirenbaum/copilot.lua",
    config = function()
        local copilot = require "copilot"
        local logger = require "copilot.logger"
        local config = {
            panel = {
                enabled = true,
                auto_refresh = false,
                keymap = {
                    jump_prev = "[[",
                    jump_next = "]]",
                    accept = "<CR>",
                    refresh = "gr",
                    open = "<M-CR>",
                },
                layout = {
                    position = "bottom", -- | top | left | right | bottom |
                    ratio = 0.4,
                },
            },
            suggestion = {
                enabled = true,
                auto_trigger = false,
                hide_during_completion = true,
                debounce = 75,
                trigger_on_accept = true,
                keymap = {
                    accept = "<C-l>",
                    accept_word = "<C-'>",
                    accept_line = "<C-;>",
                    next = "<C-]>",
                    prev = "<C-[>",
                    dismiss = false,
                },
            },
            nes = {
                enabled = true, -- requires copilot-lsp as a dependency
                auto_trigger = false,
                keymap = {
                    accept_and_goto = "<C-l>",
                    accept = "<C-L>",
                    dismiss = false,
                },
            },
            auth_provider_url = "https://github.com/", -- URL to authentication provider, if not "https://github.com/"
            logger = {
                file = vim.fn.stdpath "log" .. "/copilot-lua.log",
                file_log_level = vim.log.levels.OFF,
                print_log_level = vim.log.levels.WARN,
                trace_lsp = "off", -- "off" | "messages" | "verbose"
                trace_lsp_progress = false,
                log_lsp_messages = false,
            },
            copilot_node_command = "node", -- Node.js version must be > 22
            workspace_folders = {},
            copilot_model = "",
            disable_limit_reached_message = false, -- Set to `true` to suppress completion limit reached popup
            root_dir = function()
                return vim.fs.dirname(vim.fs.find(".git", { upward = true })[1])
            end,
            should_attach = function(_, _)
                if not vim.bo.buflisted then
                    logger.debug "not attaching, buffer is not 'buflisted'"
                    return false
                end

                if vim.bo.buftype ~= "" then
                    logger.debug("not attaching, buffer 'buftype' is " .. vim.bo.buftype)
                    return false
                end

                return true
            end,
            server = {
                type = "nodejs", -- "nodejs" | "binary"
                custom_server_filepath = nil,
            },
            server_opts_overrides = {},
        }

        copilot.setup(config)
    end,
}
