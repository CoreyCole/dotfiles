return {
    "stevearc/conform.nvim",
    event = "BufWritePre", -- format on save
    cmd = { "ConformInfo" },
    opts = function()
        return {
            formatters_by_ft = {
                lua = { "stylua" },
                python = { "isort", "black" },
                rust = { "rustfmt" },
                json = { "prettierd" },
                javascript = { "prettierd" },
                typescript = { "prettierd" },
                typescriptreact = { "prettierd" },
                javascriptreact = { "prettierd" },
                css = { "prettier" },
                -- html = { "prettier" },
                templ = { "templ" },
                c = { "clang-format" },
                cpp = { "clang-format" },
                -- go = { "gofumpt", "goimports-reviser", "golines" },
                go = {
                    -- "gofumpt",
                    -- "goimports",
                    -- "gci",
                    -- "golines",
                    "golangci_lint",
                },
                sh = { "shfmt" },
                yaml = { "yamlfmt" },
                swift = { "swiftformat" },
                -- html = { "htmlbeautifier" },
                markdown = { "mdformat" },
                proto = { "buf" },
                sql = { "sqlfluff_format", "sqlfluff_fix" },
            },
            format_on_save = {
                -- These options will be passed to conform.format()
                timeout_ms = 3000,
                lsp_fallback = false,
            },
            formatters = {
                templ = {
                    command = "templ",
                    args = { "fmt", "-stdin-filepath", "$FILENAME" },
                    stdin = true,
                },
                golangci_lint = {
                    command = "golangci-lint",
                    args = { "fmt", "--stdin" },
                    stdin = true,
                    cwd = require("conform.util").root_file { "go.mod", "go.sum" },
                    require_cwd = true,
                },
                prettierd = {
                    -- Optional: specify the command path if needed
                    command = vim.fn.stdpath "data" .. "/mason/bin/prettierd",
                },
                golines = {
                    prepend_args = { "--max-len=90", "--base-formatter=gofumpt" },
                },
                gci = function()
                    return {
                        -- A function that calculates the directory to run the command in
                        cwd = require("conform.util").root_file { "go.mod", "go.sum" },
                        -- When cwd is not found, don't run the formatter (default false)
                        require_cwd = true,
                        append_args = {
                            "-s",
                            "standard",
                            "-s",
                            "default",
                            "-s",
                            "prefix(github.com/premiumlabs/monorepo)",
                            "-s",
                            "localmodule",
                        },
                    }
                end,
                sqlfluff_format = function()
                    return {
                        command = "sqlfluff",
                        args = { "format", "-" },
                        stdin = true,
                        cwd = require("conform.util").root_file {
                            ".sqlfluff",
                            "pep8.ini",
                            "pyproject.toml",
                            "setup.cfg",
                            "tox.ini",
                        },
                        require_cwd = true,
                    }
                end,
                sqlfluff_fix = function()
                    return {
                        command = "sqlfluff",
                        args = { "fix", "-" },
                        exit_codes = { 0, 1 }, -- ignore exit code 1 as this happens when there simply exist unfixable lints
                        stdin = true,
                        cwd = require("conform.util").root_file {
                            ".sqlfluff",
                            "pep8.ini",
                            "pyproject.toml",
                            "setup.cfg",
                            "tox.ini",
                        },
                        require_cwd = true,
                    }
                end,
            },
        }
    end,
    config = function(_, opts)
        require("conform").setup(opts)
        vim.api.nvim_create_autocmd("BufEnter", {
            pattern = "*.templ",
            callback = function()
                vim.cmd "TSBufEnable highlight"
            end,
        })

        -- vim.api.nvim_create_autocmd({ "BufWritePre" }, {
        --   pattern = { "*.templ" },
        --   callback = function()
        --     print "here"
        --     vim.lsp.buf.format()
        --   end,
        -- })
    end,
}
