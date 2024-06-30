require("lint").linters_by_ft = {
  javascript = { "eslint_d" },
  typescript = { "eslint_d" },
  typescriptreact = { "eslint_d" },
  javascriptreact = { "eslint_d" },
  jsx = { "eslint" },
  tsx = { "eslint" },
  json = { "jsonlint" },
  go = { "golangcilint" },
  markdown = { "codespell" },
  proto = { "buf_lint" },
}
-- "pyright"

vim.api.nvim_create_autocmd({ "BufWritePost" }, {
  callback = function(args)
    require("lint").try_lint()
  end,
})
