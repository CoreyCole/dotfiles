local on_attach = require("plugins.configs.lspconfig").on_attach
local capabilities = require("plugins.configs.lspconfig").capabilities
local lspconfig = require("lspconfig")
local util = require("lspconfig/util")

lspconfig.pyright.setup({
  on_attach = on_attach,
  capabilities = capabilities,
  filetypes = {"python"},
})

lspconfig.gopls.setup({
  on_attach = on_attach,
  capabilities = capabilities,
  cmd = {"gopls"},
  filetypes = { "go", "gomod", "gowork", "gotmpl" },
  root_dir = util.root_pattern("go.work", "go.mod", ".git"),
  settings = {
    gopls = {
      completeUnimported = true,
      usePlaceholders = true,
      analyses = {
        unusedparams = true,
      }
    }
  }
})

vim.filetype.add({ extension = { templ = "templ" } })
lspconfig.templ.setup({
  on_attach = on_attach,
  capabilities = capabilities,
})

lspconfig.html.setup({
    on_attach = on_attach,
    capabilities = capabilities,
    filetypes = { "html", "templ" },
})

lspconfig.htmx.setup({
    on_attach = on_attach,
    capabilities = capabilities,
    filetypes = { "html", "templ" },
})

lspconfig.tailwindcss.setup({
    on_attach = on_attach,
    capabilities = capabilities,
    filetypes = { "templ", "astro", "javascript", "typescript", "react" },
    init_options = { userLanguages = { templ = "html" } },
})

local function organize_imports()
  local params = {
    command = "_typescript.organizeImports",
    arguments = {vim.api.nvim_buf_get_name(0)},
  }
  vim.lsp.buf.execute_command(params)
end

lspconfig.tsserver.setup({
  on_attach = on_attach,
  capabilities = capabilities,
  init_options = {
    preferences = {
      disableSuggestions = true,
    },
  },
  commands = {
    OrganizeImports = {
      organize_imports,
      description = "Organize Imports",
    },
  },
})
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
