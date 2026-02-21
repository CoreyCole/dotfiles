return {
    "folke/sidekick.nvim",
    opts = {
        -- add any options here
        nes = { enabled = false },
        cli = {
            mux = {
                backend = "tmux",
                enabled = true,
                create = "split",
                split = {
                    vertical = true,
                    size = 0.4,
                },
            },
            tools = {
                claude = {
                    cmd = { "claude", "--dangerously-skip-permissions" },
                },
            },
        },
    },
    keys = {
        {
            "<c-.>",
            function()
                require("sidekick.cli").toggle()
            end,
            desc = "Sidekick Toggle",
            mode = { "n", "t", "i", "x" },
        },
        {
            "<leader>aa",
            function()
                require("sidekick.cli").toggle()
            end,
            desc = "Sidekick Toggle CLI",
        },
        {
            "<leader>as",
            function()
                require("sidekick.cli").select()
            end,
            -- Or to select only installed tools:
            -- require("sidekick.cli").select({ filter = { installed = true } })
            desc = "Select CLI",
        },
        {
            "<leader>ad",
            function()
                require("sidekick.cli").close()
            end,
            desc = "Detach a CLI Session",
        },
        {
            "<leader>at",
            function()
                require("sidekick.cli").send { msg = "{this}" }
            end,
            mode = { "x", "n" },
            desc = "Send This",
        },
        {
            "<leader>af",
            function()
                require("sidekick.cli").send { msg = "{file}" }
            end,
            desc = "Send File",
        },
        {
            "<leader>av",
            function()
                require("sidekick.cli").send { msg = "{selection}" }
            end,
            mode = { "x" },
            desc = "Send Visual Selection",
        },
        {
            "<leader>ap",
            function()
                require("sidekick.cli").prompt()
            end,
            mode = { "n", "x" },
            desc = "Sidekick Select Prompt",
        },
        -- Example of a keybinding to open Claude directly
        {
            "<leader>ac",
            function()
                require("sidekick.cli").toggle { name = "claude", focus = true }
            end,
            desc = "Sidekick Toggle Claude",
        },
        {
            "<leader>ar",
            function()
                local Session = require "sidekick.cli.session"
                local Config = require "sidekick.config"

                -- Find the sidekick Claude session for THIS neovim instance
                local target_session_id = nil

                -- Look for sidekick windows in this neovim instance
                for _, win in ipairs(vim.api.nvim_list_wins()) do
                    local session_id = vim.w[win].sidekick_session_id
                    local tool = vim.w[win].sidekick_cli
                    if session_id and tool and tool.name == "claude" then
                        target_session_id = session_id
                        break
                    end
                end

                -- Get the tmux session name for this specific session
                local tmux_session_name = nil
                if target_session_id then
                    local sessions = Session.attached()
                    for _, session in pairs(sessions) do
                        if session.id == target_session_id then
                            -- Get the tmux session name from the session metadata
                            if session.mux_session then
                                tmux_session_name = session.mux_session
                            elseif session.parent and session.parent.mux_session then
                                tmux_session_name = session.parent.mux_session
                            end
                            break
                        end
                    end
                end

                -- Close the sidekick UI
                require("sidekick.cli").close()

                -- Kill the specific tmux session
                if tmux_session_name then
                    vim.fn.system("tmux kill-session -t " .. vim.fn.shellescape(tmux_session_name))
                end

                -- Wait for cleanup, then restart Claude with --continue
                -- Save original config
                local original_config = vim.deepcopy(Config.cli.tools["claude"])

                -- Modify the source config (not a copy)
                Config.cli.tools["claude"] = Config.cli.tools["claude"] or {}
                Config.cli.tools["claude"].cmd = { "claude", "--continue", "--dangerously-skip-permissions" }

                -- Bypass toggle (which opens picker) and directly create/attach session
                local State = require "sidekick.cli.state"
                local new_session = Session.new { tool = "claude" }
                new_session = Session.attach(new_session)

                -- Get state and show the terminal
                local state = State.get_state(new_session)
                if state.terminal then
                    state.terminal:show()
                    state.terminal:focus()
                end

                -- Restore original config after session starts
                if original_config then
                    Config.cli.tools["claude"] = original_config
                else
                    Config.cli.tools["claude"] = nil
                end

                -- Close and toggle to ensure clean state
                require("sidekick.cli").close()
                require("sidekick.cli").toggle()

                vim.notify "Claude restarted with --continue"
            end,
            desc = "Kill Claude and restart with --continue",
        },
        -- Exit terminal mode and navigate windows
        {
            "<C-h>",
            function()
                vim.cmd "stopinsert"
                vim.cmd "wincmd h"
            end,
            desc = "Exit terminal and focus left",
            mode = "t",
        },
        {
            "<C-j>",
            function()
                vim.cmd "stopinsert"
                vim.cmd "wincmd j"
            end,
            desc = "Exit terminal and focus down",
            mode = "t",
        },
        {
            "<C-k>",
            function()
                vim.cmd "stopinsert"
                vim.cmd "wincmd k"
            end,
            desc = "Exit terminal and focus up",
            mode = "t",
        },
        {
            "<C-l>",
            function()
                vim.cmd "stopinsert"
                vim.cmd "wincmd l"
            end,
            desc = "Exit terminal and focus right",
            mode = "t",
        },
    },
}
