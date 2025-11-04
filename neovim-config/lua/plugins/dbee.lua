return {
    "kndndrj/nvim-dbee",
    event = "VeryLazy",
    dependencies = {
        "MunifTanjim/nui.nvim",
        "MattiasMTS/cmp-dbee",
    },
    build = function()
        -- Install tries to automatically detect the install method.
        -- if it fails, try calling it with one of these parameters:
        --    "curl", "wget", "bitsadmin", "go"
        require("dbee").install()
    end,
    keys = {
        {
            "<leader>dt",
            function()
                require("dbee").toggle()
            end,
            desc = "Toggle DB UI",
        },
        {
            "<leader>do",
            function()
                require("dbee").open()
            end,
            desc = "Open DB UI",
        },
        {
            "<leader>dc",
            function()
                require("dbee").close()
            end,
            desc = "Close DB UI",
        },
        {
            "<leader>de",
            function()
                require("dbee").execute()
            end,
            desc = "Execute DB query",
        },
        {
            "<leader>ds",
            function()
                require("dbee").store("csv", "file", {})
            end,
            desc = "Store DB results",
        },
        {
            "<leader>dy",
            function()
                -- Store to yank register
                require("dbee").store("json", "yank", {})
                -- Also try copying unnamed register to system clipboard
                vim.defer_fn(function()
                    local yanked = vim.fn.getreg('"')
                    if yanked and yanked ~= "" then
                        vim.fn.setreg("+", yanked)
                        vim.notify("Copied to clipboard", vim.log.levels.INFO)
                    else
                        vim.notify("Nothing to copy", vim.log.levels.WARN)
                    end
                end, 100)
            end,
            desc = "Yank DB results as JSON",
        },
    },
    config = function()
        require("dbee").setup {
            require("dbee.sources").EnvSource:new "DBEE_CONNECTIONS",
        }

        -- Override <leader>e in dbee buffers
        vim.api.nvim_create_autocmd("BufEnter", {
            callback = function(args)
                local bufname = vim.api.nvim_buf_get_name(args.buf)
                if bufname:match("dbee") then
                    -- <leader>e focuses the drawer
                    vim.keymap.set("n", "<leader>e", function()
                        -- Find the drawer window and focus it
                        for _, win in ipairs(vim.api.nvim_list_wins()) do
                            local buf = vim.api.nvim_win_get_buf(win)
                            local name = vim.api.nvim_buf_get_name(buf)
                            if name:match("dbee%-drawer") then
                                vim.api.nvim_set_current_win(win)
                                return
                            end
                        end
                    end, { buffer = args.buf, desc = "Focus DB sidebar" })

                    -- Disable <C-n> in dbee buffers
                    vim.keymap.set("n", "<C-n>", "<Nop>", { buffer = args.buf, desc = "Disabled in dbee" })
                end
            end,
        })
    end,
}
