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
                    "isort",
                    "black",
                    "mypy",
                    "ruff",
                    "ruff-lsp",
                    "pyright",
                    "debugpy",
                    "marksman",
                    "buf",
                    "gofumpt",
                    "gopls",
                    "goimports-reviser",
                    "golines",
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

        local client_capabilities = function()
            return vim.tbl_deep_extend("force", capabilities, {
                workspace = {
                    didChangeWatchedFiles = { dynamicRegistration = false }, -- this is broken on mac
                },
            })
        end
        capabilities = client_capabilities()

        local util = require "lspconfig.util"
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

        vim.lsp.config.just = {
            capabilities = capabilities,
            cmd = { "/Users/coreycole/.cargo/bin/just-lsp" },
            filetypes = { "just" },
            root_dir = function(fname)
                return util.find_git_ancestor(fname)
            end,
            settings = {},
        }

        vim.lsp.config.gopls = {
            capabilities = capabilities,
            cmd = { "gopls" },
            filetypes = { "go", "gomod", "gowork", "gotmpl" },
            root_dir = util.root_pattern("go.work", "go.mod", ".git"),
            flags = { debounce_text_changes = 200 },
            single_file_support = false,
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
            filetypes = { "proto" },
            root_dir = util.root_pattern ".git",
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

        -- Enable all configured LSP servers
        local configured_servers = {
            "pyright",
            "just",
            "gopls",
            "golangci_lint_ls",
            "buf_ls",
            "templ",
            "html",
            "htmx",
            "tailwindcss",
            "ts_ls",
        }
        for _, lsp in ipairs(configured_servers) do
            vim.lsp.enable(lsp)
        end

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
