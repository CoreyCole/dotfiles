-- local opts = {
--   formatters_by_ft = {
--     templ = { "htmlbeautifier", "gofumt" },
--     lua = { "stylua" },
--     python = { "isort", "black" },
--     rust = { "rustfmt" },
--     json = { "prettierd", "prettier", stop_after_first = true },
--     javascript = { "prettierd", "prettier", stop_after_first = true },
--     typescript = { "prettierd", "prettier", stop_after_first = true },
--     typescriptreact = { "pretterd", "prettier", stop_after_first = true },
--     javascriptreact = { "prettierd", "prettier", stop_after_first = true },
--     css = { "prettier" },
--     html = { "prettier" },
--     c = { "clang-format" },
--     cpp = { "clang-format" },
--     -- go = { "gofumpt", "goimports-reviser", "golines" },
--     go = { "goimports", "gci", "golines" },
--     sh = { "shfmt" },
--     yaml = { "yamlfmt" },
--     swift = { "swiftformat" },
--     html = { "htmlbeautifier" },
--     markdown = { "mdformat" },
--     proto = { "buf" },
--     ["*"] = { "codespell" },
--   },
--   format_on_save = {
--     -- These options will be passed to conform.format()
--     timeout_ms = 500,
--     lsp_fallback = false,
--   },
--   formatters = {
--     golines = {
--       prepend_args = { "--max-len=90", "--base-formatter=gofumpt" },
--     },
--     gci = function()
--       return {
--         -- A function that calculates the directory to run the command in
--         cwd = require("conform.util").root_file { "go.mod", "go.sum" },
--         -- When cwd is not found, don't run the formatter (default false)
--         require_cwd = false,
--         append_args = {
--           "-s",
--           "standard",
--           "-s",
--           "default",
--           "-s",
--           "prefix(github.com/premiumlabs/monorepo)",
--           "-s",
--           "localmodule",
--         },
--       }
--     end,
--   },
-- }
-- ["*"] = {
--   require("formatter.filetypes.any").remove_trailing_whitespace
-- }

-- typescriptreact = {
--   require("formatter.filetypes.typescriptreact").prettier
-- },
-- javascriptreact = {
--   require("formatter.filetypes.javascriptreact").prettier
-- },

-- require("none-ls.builtins.formatting.gofumt"),
-- require("none-ls.builtins.formatting.goimports_reviser"),
-- require("none-ls.builtins.formatting.golines"),
-- require("none-ls.builtins.formatting.prettier"),
-- require("none-ls.builtins.formatting.black"),
-- require("none-ls.builtins.formatting.rustywind"),
-- require("none-ls.builtins.formatting.sqlformat"),
