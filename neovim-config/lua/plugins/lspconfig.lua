return {
    "neovim/nvim-lspconfig",
    event = "BufReadPre",
    dependencies = {
        {
            "williamboman/mason.nvim",
            opts = {
                ensure_installed = {
                    "lua-language-server",
                    "stylua",
                    "codespell",
                    "clangd",
                    "clang-format",
                    "codelldb",
                    -- "isort",
                    -- "black",
                    "mypy",
                    "ruff",
                    "ruff-lsp",
                    "pyright",
                    "debugpy",
                    -- "marksman",
                    "buf",
                    "gopls",
                    "templ",
                    "htmx-lsp",
                    "html-lsp",
                    "tailwindcss-language-server",
                    "rust-analyzer",
                    "rustywind",
                    "shfmt",
                    "css-lsp",
                    "typescript-language-server",
                    "vtsls",
                    "eslint-lsp",
                    "js-debug-adapter",
                    "prettier",
                    "prettierd",
                },
            },
        },
    },
    config = function()
        local capabilities = vim.lsp.protocol.make_client_capabilities()
        capabilities = require("blink.cmp").get_lsp_capabilities(capabilities)

        -- Simple servers with default config
        local servers = {
            "lua_ls",
            "cssls",
        }

        local golangci_lint_args = function()
            local defaults = {
                "golangci-lint",
                "run",
                "--fix",
                "--output.json.path=stdout",
                -- Overwrite values possibly set in .golangci.yml
                "--output.text.path=",
                "--output.tab.path=",
                "--output.html.path=",
                "--output.checkstyle.path=",
                "--output.code-climate.path=",
                "--output.junit-xml.path=",
                "--output.teamcity.path=",
                "--output.sarif.path=",
                "--show-stats=false",
                "--build-tags=integration,unit",
            }

            local config = vim.fs.find(
                { ".golangci.yml" },
                { path = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(0), ":p:h"), upward = true }
            )
            if #config > 0 then
                local config_path = vim.fn.fnamemodify(config[1], ":p")
                table.insert(defaults, "--config")
                table.insert(defaults, config_path)
            end

            return defaults
        end

        -- lsps with default config
        for _, lsp in ipairs(servers) do
            vim.lsp.config[lsp] = {
                capabilities = capabilities,
            }
            vim.lsp.enable(lsp)
        end

        vim.lsp.config.pyright = {
            capabilities = capabilities,
            filetypes = { "python" },
        }

        -- vim.lsp.config.ruff_lsp = {
        --   capabilities = capabilities,
        --   filetypes = { "python" },
        -- }

        -- vim.lsp.config.just = {
        --     capabilities = capabilities,
        --     cmd = { "/Users/coreycole/.cargo/bin/just-lsp" },
        --     filetypes = { "just" },
        --     root_dir = function(fname)
        --         return util.find_git_ancestor(fname)
        --     end,
        --     settings = {},
        -- }

        vim.lsp.config.gopls = {
            capabilities = capabilities,
            flags = { debounce_text_changes = 200 },
            settings = {
                gopls = {
                    usePlaceholders = true,
                    gofumpt = true,
                    analyses = {
                        nilness = true,
                        unusedparams = true,
                        unusedwrite = true,
                        unusedvariable = true,
                        useany = true,
                        shadow = false,
                    },
                    codelenses = {
                        gc_details = true,
                        generate = true,
                        regenerate_cgo = true,
                        run_govulncheck = true,
                        test = true,
                        tidy = true,
                        upgrade_dependency = true,
                        vendor = true,
                    },
                    experimentalPostfixCompletions = true,
                    completeUnimported = true,
                    staticcheck = true,
                    directoryFilters = { "-.git", "-node_modules" },
                    semanticTokens = true,
                    symbolScope = "all",
                    hints = {
                        assignVariableTypes = true,
                        compositeLiteralFields = true,
                        compositeLiteralTypes = true,
                        constantValues = true,
                        functionTypeParameters = true,
                        parameterNames = true,
                        rangeVariableTypes = true,
                    },
                    buildFlags = { "-tags=integration,unit,e2e" },
                },
            },
        }

        vim.lsp.config.golangci_lint_ls = {
            cmd = (function(debug)
                if debug then
                    return { "golangci-lint-langserver", "-debug" }
                end
                return { "golangci-lint-langserver" }
            end)(false),
            init_options = {
                command = golangci_lint_args(),
            },
            capabilities = capabilities,
            filetypes = { "go" },
            -- root_dir = function(fname)
            --   -- First try to find go.mod
            --   local go_mod_root = util.root_pattern("go.mod")(fname)
            --   if go_mod_root then
            --     return go_mod_root
            --   end
            --   -- Fall back to git root
            --   return util.root_pattern(".git")(fname)
            -- end,
        }

        vim.lsp.config.buf_ls = {
            capabilities = capabilities,
        }

        vim.filetype.add { extension = { templ = "templ" } }
        vim.lsp.config.templ = {
            capabilities = capabilities,
        }

        vim.lsp.config.html = {
            capabilities = capabilities,
            filetypes = { "html", "templ", "jsx", "tsx", "typescriptreact" },
        }

        vim.lsp.config.htmx = {
            capabilities = capabilities,
            filetypes = { "html", "templ" },
        }

        vim.lsp.config.tailwindcss = {
            capabilities = capabilities,
            filetypes = { "templ", "astro", "javascript", "typescript", "react" },
            settings = {
                tailwindCSS = {
                    includeLanguages = {
                        templ = "html",
                    },
                },
            },
        }

        -- Use traditional lspconfig for sqls
        local lspconfig = require "lspconfig"
        local util = require "lspconfig.util"

        lspconfig.sqls.setup {
            capabilities = capabilities,
            cmd = { "/usr/local/go/bin/sqls" },
            filetypes = { "sql", "mysql" },
            root_dir = function(fname)
                return util.find_git_ancestor(fname) or vim.fn.getcwd()
            end,
            single_file_support = true, -- Allow sqls to work even without a project root
            autostart = true,
            settings = {},
            on_attach = function(client, bufnr)
                vim.notify("sqls attached to buffer " .. bufnr)
            end,
        }

        -- Force start sqls for SQL files since autostart might not work
        vim.api.nvim_create_autocmd("FileType", {
            pattern = { "sql", "mysql" },
            callback = function()
                vim.cmd "LspStart sqls"
            end,
        })

        vim.lsp.config.ts_ls = {
            capabilities = capabilities,
            -- init_options = {
            --   preferences = {
            --     disableSuggestions = true,
            --   },
            -- },
            -- -- commands = {
            -- OrganizeImports = {
            --   function()
            --     local params = {
            --       command = "_typescript.organizeImports",
            --       arguments = { vim.api.nvim_buf_get_name(0) },
            --     }
            --     vim.lsp.buf.execute_command(params)
            --   end,
            --   description = "Organize Imports",
            -- },
        }

        -- sqls is now configured in lua/plugins/sqls.lua using native vim.lsp.config

        -- Enable all configured LSP servers
        local configured_servers = {
            "pyright",
            -- "just",
            "gopls",
            "golangci_lint_ls",
            "buf_ls",
            "templ",
            "html",
            "htmx",
            "tailwindcss",
            "ts_ls",
            -- "sqls", -- now using traditional lspconfig setup above
        }
        for _, lsp in ipairs(configured_servers) do
            vim.lsp.enable(lsp)
        end

        vim.api.nvim_create_autocmd("LspAttach", {
            desc = "Configure LSP keymaps",
            callback = function(args)
                local client = vim.lsp.get_client_by_id(args.data.client_id)

                -- I don't think this can happen but it's a wild world out there.
                if not client then
                    return
                end

                if client.name == "sqls" then
                    vim.notify "sqls attached"
                    client.server_capabilities.executeCommandProvider = true
                    client.server_capabilities.codeActionProvider = { resolveProvider = false }

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
                    local client_id = client.id
                    vim.api.nvim_buf_create_user_command(args.buf, "SqlsExecuteQuery", function(args)
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
                    vim.api.nvim_buf_create_user_command(args.buf, "SqlsExecuteQueryVertical", function(args)
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
                    vim.api.nvim_buf_create_user_command(args.buf, "SqlsShowDatabases", function(args)
                        require("sqls.commands").exec(client_id, "showDatabases", args.smods)
                    end, {})
                    vim.api.nvim_buf_create_user_command(args.buf, "SqlsShowSchemas", function(args)
                        require("sqls.commands").exec(client_id, "showSchemas", args.smods)
                    end, {})
                    vim.api.nvim_buf_create_user_command(args.buf, "SqlsShowConnections", function(args)
                        require("sqls.commands").exec(client_id, "showConnections", args.smods)
                    end, {})
                    vim.api.nvim_buf_create_user_command(args.buf, "SqlsShowTables", function(args)
                        require("sqls.commands").exec(client_id, "showTables", args.smods)
                    end, {})
                    -- Not yet supported by the language server:
                    -- vim.api.nvim_buf_create_user_command(args.buf, 'SqlsDescribeTable', function(args)
                    --     require('sqls.commands').exec(client_id, 'describeTable', args.smods)
                    -- end, {})
                    vim.api.nvim_buf_create_user_command(args.buf, "SqlsSwitchDatabase", function(args)
                        require("sqls.commands").switch_database(client_id, args.args ~= "" and args.args or nil)
                    end, { nargs = "?" })
                    vim.api.nvim_buf_create_user_command(args.buf, "SqlsSwitchConnection", function(args)
                        require("sqls.commands").switch_connection(client_id, args.args ~= "" and args.args or nil)
                    end, { nargs = "?" })

                    vim.api.nvim_buf_set_keymap(
                        args.buf,
                        "n",
                        "<Plug>(sqls-execute-query)",
                        "<Cmd>let &opfunc='{type -> sqls_nvim#query(type, " .. client_id .. ")}'<CR>g@",
                        { silent = true }
                    )
                    vim.api.nvim_buf_set_keymap(
                        args.buf,
                        "x",
                        "<Plug>(sqls-execute-query)",
                        "<Cmd>let &opfunc='{type -> sqls_nvim#query(type, " .. client_id .. ")}'<CR>g@",
                        { silent = true }
                    )
                    vim.api.nvim_buf_set_keymap(
                        args.buf,
                        "n",
                        "<Plug>(sqls-execute-query-vertical)",
                        "<Cmd>let &opfunc='{type -> sqls_nvim#query_vertical(type, " .. client_id .. ")}'<CR>g@",
                        { silent = true }
                    )
                    vim.api.nvim_buf_set_keymap(
                        args.buf,
                        "x",
                        "<Plug>(sqls-execute-query-vertical)",
                        "<Cmd>let &opfunc='{type -> sqls_nvim#query_vertical(type, " .. client_id .. ")}'<CR>g@",
                        { silent = true }
                    )
                    -- Additional keymaps
                    local opts = { noremap = true, silent = true, buffer = bufnr }

                    -- Execute query operator mappings
                    vim.keymap.set("n", "<leader>se", "<Plug>(sqls-execute-query)", opts)
                    vim.keymap.set("x", "<leader>se", "<Plug>(sqls-execute-query)", opts)

                    -- Execute query vertical operator mappings
                    vim.keymap.set("n", "<leader>sv", "<Plug>(sqls-execute-query-vertical)", opts)
                    vim.keymap.set("x", "<leader>sv", "<Plug>(sqls-execute-query-vertical)", opts)

                    -- Additional convenience mappings
                    vim.keymap.set("n", "<leader>sd", "<cmd>SqlsShowDatabases<CR>", opts)
                    vim.keymap.set("n", "<leader>ss", "<cmd>SqlsShowSchemas<CR>", opts)
                    vim.keymap.set("n", "<leader>sc", "<cmd>SqlsShowConnections<CR>", opts)
                    vim.keymap.set("n", "<leader>st", "<cmd>SqlsShowTables<CR>", opts)
                    vim.keymap.set("n", "<leader>sD", "<cmd>SqlsSwitchDatabase<CR>", opts)
                    vim.keymap.set("n", "<leader>sC", "<cmd>SqlsSwitchConnection<CR>", opts)

                    -- Execute current line or paragraph
                    vim.keymap.set("n", "<leader>sel", "<leader>se_", { remap = true, buffer = bufnr })
                    vim.keymap.set("n", "<leader>sep", "<leader>seip", { remap = true, buffer = bufnr })
                    vim.keymap.set("n", "<leader>sea", "<leader>seG", { remap = true, buffer = bufnr })
                end
            end,
        })

        -- local servers = { 'ccls', 'cmake', 'templ' }
        -- for _, lsp in ipairs(servers) do
        --   lspconfig[lsp].setup({
        --     capabilities = capabilities,
        --   })
        -- end
        -- root_dir = function(...)
        --   return require("lspconfig.util").root_pattern(".git")(...)
        -- end,
        -- single_file_support = false,
        -- settings = {
        --   typescript = {
        --     inlayHints = {
        --       includeInlayParameterNameHints = "literal",
        --       includeInlayParameterNameHintsWhenArgumentMatchesName = false,
        --       includeInlayFunctionParameterTypeHints = true,
        --       includeInlayVariableTypeHints = false,
        --       includeInlayPropertyDeclarationTypeHints = true,
        --       includeInlayFunctionLikeReturnTypeHints = true,
        --       includeInlayEnumMemberValueHints = true,
        --     },
        --   },
        --   javascript = {
        --     inlayHints = {
        --       includeInlayParameterNameHints = "all",
        --       includeInlayParameterNameHintsWhenArgumentMatchesName = false,
        --       includeInlayFunctionParameterTypeHints = true,
        --       includeInlayVariableTypeHints = true,
        --       includeInlayPropertyDeclarationTypeHints = true,
        --       includeInlayFunctionLikeReturnTypeHints = true,
        --       includeInlayEnumMemberValueHints = true,
        --     },
        --   },
        -- },
        -- })
    end,
}
