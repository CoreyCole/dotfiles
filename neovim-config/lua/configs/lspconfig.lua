local on_attach = require("nvchad.configs.lspconfig").on_attach
local on_init = require("nvchad.configs.lspconfig").on_init
local capabilities = require("nvchad.configs.lspconfig").capabilities

local lspconfig = require "lspconfig"
local util = require "lspconfig/util"
local servers = {
  "gopls",
  "pyright",
  -- "ruff_lsp",
  "html",
  "templ",
  "htmx",
  "tsserver",
  "tailwindcss",
  "cssls",
}

-- lsps with default config
for _, lsp in ipairs(servers) do
  lspconfig[lsp].setup {
    on_attach = on_attach,
    on_init = on_init,
    capabilities = capabilities,
  }
end

lspconfig.pyright.setup {
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
  filetypes = { "python" },
}

-- lspconfig.ruff_lsp.setup {
--   on_attach = on_attach,
--   on_init = on_init,
--   capabilities = capabilities,
--   filetypes = { "python" },
-- }

lspconfig.gopls.setup {
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
  cmd = { "gopls" },
  filetypes = { "go", "gomod", "gowork", "gotmpl" },
  root_dir = util.root_pattern("go.work", "go.mod", ".git"),
  settings = {
    gopls = {
      completeUnimported = true,
      usePlaceholders = true,
      analyses = {
        unusedparams = true,
      },
    },
  },
}

vim.filetype.add { extension = { templ = "templ" } }
lspconfig.templ.setup {
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
}

lspconfig.html.setup {
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
  filetypes = { "html", "templ", "jsx", "tsx", "typescriptreact" },
}

lspconfig.htmx.setup {
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
  filetypes = { "html", "templ" },
}

lspconfig.tailwindcss.setup {
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
  filetypes = { "templ", "astro", "javascript", "typescript", "react" },
  init_options = { userLanguages = { templ = "html" } },
}

lspconfig.tsserver.setup {
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
  init_options = {
    preferences = {
      disableSuggestions = true,
    },
  },
  -- commands = {
  OrganizeImports = {
    function()
      local params = {
        command = "_typescript.organizeImports",
        arguments = { vim.api.nvim_buf_get_name(0) },
      }
      vim.lsp.buf.execute_command(params)
    end,
    description = "Organize Imports",
  },
}

-- local servers = { 'ccls', 'cmake', 'templ' }
-- for _, lsp in ipairs(servers) do
--   lspconfig[lsp].setup({
--     on_attach = on_attach,
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
