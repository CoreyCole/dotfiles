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
                css = { "prettierd" },
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
                    "golangci_lint_fix",
                    "golangci_lint",
                },
                sh = { "shfmt" },
                yaml = { "yamlfmt" },
                swift = { "swiftformat" },
                -- html = { "htmlbeautifier" },
                markdown = { "mdformat" },
                proto = { "buf" },
                sql = { "sqruff" },
                nix = { "alejandra" },
            },
            format_on_save = {
                -- These options will be passed to conform.format()
                timeout_ms = 3000,
                lsp_fallback = false,
            },
            formatters = {
                -- Override the built-in sqruff formatter to work properly
                sqruff = {
                    command = "sqruff",
                    args = { "fix", "$FILENAME" },
                    stdin = false,
                    exit_codes = { 0, 1 }, -- sqruff returns 1 if there are unfixable violations
                },
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
                golangci_lint_fix = {
                    command = "golangci-lint",
                    args = { "run", "--fix", "$FILENAME" },
                    stdin = false,
                    cwd = require("conform.util").root_file { "go.mod", "go.sum" },
                    require_cwd = true,
                    exit_codes = { 0, 1 }, -- returns 1 if there are unfixable lint issues
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
