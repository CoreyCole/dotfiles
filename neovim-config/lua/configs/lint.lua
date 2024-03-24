require("lint").linters_by_ft = {
  javascript = { "eslint" },
  typescript = { "eslint" },
  typescriptreact = { "eslint" },
  javascriptreact = { "eslint" },
  jsx = { "eslint" },
  tsx = { "eslint" },
  json = { "jsonlint" },
  go = { "golangcilint" },
  markdown = { "codespell" },
}
-- "pyright"

vim.api.nvim_create_autocmd({ "BufWritePost" }, {
  callback = function()
    require("lint").try_lint()
  end,
})
