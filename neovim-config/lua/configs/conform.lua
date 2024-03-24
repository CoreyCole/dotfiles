local opts = {
  formatters_by_ft = {
    lua = { "stylua" },
    python = { "isort", "black" },
    rust = { "rustfmt" },
    json = { "prettier" },
    javascript = { "prettier" },
    typescript = { "prettier" },
    typescriptreact = { "prettier" },
    javascriptreact = { "prettier" },
    css = { "prettier" },
    html = { "prettier" },
    c = { "clang-format" },
    cpp = { "clang-format" },
    go = { "gofumpt", "goimports-reviser", "golines" },
    sh = { "shfmt" },
    yaml = { "yamlfmt" },
    swift = { "swiftformat" },
    html = { "htmlbeautifier" },
    markdown = { "mdformat" },
  },
  format_on_save = {
    -- These options will be passed to conform.format()
    timeout_ms = 500,
    lsp_fallback = true,
  },
}
require("conform").setup(opts)
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
