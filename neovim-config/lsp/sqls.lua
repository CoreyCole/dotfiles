vim.api.nvim_create_autocmd("FileType", {
    pattern = { "sql", "mysql" },
    callback = function()
        vim.notify "starting sqls"
        vim.lsp.start(vim.lsp.config.sqls)
    end,
})

---@type vim.lsp.Config
return {
    cmd = { "/usr/local/go/bin/sqls" },
    filetypes = { "sql", "mysql" },
    root_markers = { ".git" }, -- Simplified from function
    single_file_support = true,
    autostart = true,
    settings = {},
    capabilities = capabilities,
    on_attach = function(client, bufnr)
        vim.notify "attached sqls"
        -- Enable executeCommand and codeAction capabilities
        client.server_capabilities.executeCommandProvider = true
        client.server_capabilities.codeActionProvider = { resolveProvider = false }

        -- Define commands
        client.commands = {
            executeQuery = function(_, client)
                require("sqls.commands").exec(client.client_id, "executeQuery")
            end,
            showDatabases = function(_, client)
                require("sqls.commands").exec(client.client_id, "showDatabases")
            end,
            showSchemas = function(_, client)
                require("sqls.commands").exec(client.client_id, "showSchemas")
            end,
            showConnections = function(_, client)
                require("sqls.commands").exec(client.client_id, "showConnections")
            end,
            showTables = function(_, client)
                require("sqls.commands").exec(client.client_id, "showTables")
            end,
            describeTable = function(_, client)
                require("sqls.commands").exec(client.client_id, "describeTable")
            end,
            switchConnections = function(_, client)
                require("sqls.commands").switch_connection(client.client_id)
            end,
            switchDatabase = function(_, client)
                require("sqls.commands").switch_database(client.client_id)
            end,
        }

        -- Create user commands
        local client_id = client.id
        vim.api.nvim_buf_create_user_command(bufnr, "SqlsExecuteQuery", function(args)
            require("sqls.commands").exec(
                client_id,
                "executeQuery",
                args.smods,
                args.range ~= 0,
                nil,
                args.line1,
                args.line2
            )
        end, { range = true })

        vim.api.nvim_buf_create_user_command(bufnr, "SqlsExecuteQueryVertical", function(args)
            require("sqls.commands").exec(
                client_id,
                "executeQuery",
                args.smods,
                args.range ~= 0,
                "-show-vertical",
                args.line1,
                args.line2
            )
        end, { range = true })

        vim.api.nvim_buf_create_user_command(bufnr, "SqlsShowDatabases", function(args)
            require("sqls.commands").exec(client_id, "showDatabases", args.smods)
        end, {})

        vim.api.nvim_buf_create_user_command(bufnr, "SqlsShowSchemas", function(args)
            require("sqls.commands").exec(client_id, "showSchemas", args.smods)
        end, {})

        vim.api.nvim_buf_create_user_command(bufnr, "SqlsShowConnections", function(args)
            require("sqls.commands").exec(client_id, "showConnections", args.smods)
        end, {})

        vim.api.nvim_buf_create_user_command(bufnr, "SqlsShowTables", function(args)
            require("sqls.commands").exec(client_id, "showTables", args.smods)
        end, {})

        vim.api.nvim_buf_create_user_command(bufnr, "SqlsSwitchDatabase", function(args)
            require("sqls.commands").switch_database(client_id, args.args ~= "" and args.args or nil)
        end, { nargs = "?" })

        vim.api.nvim_buf_create_user_command(bufnr, "SqlsSwitchConnection", function(args)
            require("sqls.commands").switch_connection(client_id, args.args ~= "" and args.args or nil)
        end, { nargs = "?" })

        -- Set up keymaps
        vim.api.nvim_buf_set_keymap(
            bufnr,
            "n",
            "<Plug>(sqls-execute-query)",
            "<Cmd>let &opfunc='{type -> sqls_nvim#query(type, " .. client_id .. ")}'<CR>g@",
            { silent = true }
        )
        vim.api.nvim_buf_set_keymap(
            bufnr,
            "x",
            "<Plug>(sqls-execute-query)",
            "<Cmd>let &opfunc='{type -> sqls_nvim#query(type, " .. client_id .. ")}'<CR>g@",
            { silent = true }
        )
        vim.api.nvim_buf_set_keymap(
            bufnr,
            "n",
            "<Plug>(sqls-execute-query-vertical)",
            "<Cmd>let &opfunc='{type -> sqls_nvim#query_vertical(type, " .. client_id .. ")}'<CR>g@",
            { silent = true }
        )
        vim.api.nvim_buf_set_keymap(
            bufnr,
            "x",
            "<Plug>(sqls-execute-query-vertical)",
            "<Cmd>let &opfunc='{type -> sqls_nvim#query_vertical(type, " .. client_id .. ")}'<CR>g@",
            { silent = true }
        )

        -- Additional keymaps
        local opts = { noremap = true, silent = true, buffer = bufnr }
        vim.keymap.set("n", "<leader>se", "<Plug>(sqls-execute-query)", opts)
        vim.keymap.set("x", "<leader>se", "<Plug>(sqls-execute-query)", opts)
        vim.keymap.set("n", "<leader>sv", "<Plug>(sqls-execute-query-vertical)", opts)
        vim.keymap.set("x", "<leader>sv", "<Plug>(sqls-execute-query-vertical)", opts)
        vim.keymap.set("n", "<leader>sd", "<cmd>SqlsShowDatabases<CR>", opts)
        vim.keymap.set("n", "<leader>ss", "<cmd>SqlsShowSchemas<CR>", opts)
        vim.keymap.set("n", "<leader>sc", "<cmd>SqlsShowConnections<CR>", opts)
        vim.keymap.set("n", "<leader>st", "<cmd>SqlsShowTables<CR>", opts)
        vim.keymap.set("n", "<leader>sD", "<cmd>SqlsSwitchDatabase<CR>", opts)
        vim.keymap.set("n", "<leader>sC", "<cmd>SqlsSwitchConnection<CR>", opts)
        vim.keymap.set("n", "<leader>sel", "<leader>se_", { remap = true, buffer = bufnr })
        vim.keymap.set("n", "<leader>sep", "<leader>seip", { remap = true, buffer = bufnr })
        vim.keymap.set("n", "<leader>sea", "<leader>seG", { remap = true, buffer = bufnr })

        vim.notify("sqls attached to buffer " .. bufnr)
    end,
}
