local on_attach = require("nvchad.configs.lspconfig").on_attach
local on_init = require("nvchad.configs.lspconfig").on_init
local capabilities = require("nvchad.configs.lspconfig").capabilities

local client_capabilities = function()
  return vim.tbl_deep_extend("force", capabilities, {
    workspace = {
      didChangeWatchedFiles = { dynamicRegistration = false }, -- this is broken on mac
    },
  })
end
capabilities = client_capabilities()

local lspconfig = require "lspconfig"
local util = require "lspconfig/util"
local servers = {
  "gopls",
  "buf_ls",
  "pyright",
  -- "ruff_lsp",
  "html",
  "templ",
  -- "htmx",
  "ts_ls",
  "tailwindcss",
  "cssls",
}

local golangci_lint_args = function()
  local defaults = {
    "golangci-lint",
    "run",
    "--tests",
    "--build-tags",
    "integration,unit",
    "--allow-parallel-runners",
    "--max-issues-per-linter",
    "0",
    "--max-same-issues",
    "0",
    "--out-format",
    "json",
  }

  local config = vim.fs.find(
    { ".golangci.yml" },
    { path = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(0), ":p:h"), upward = true }
  )
  if #config == 0 then
    return defaults
  end

  local config_path = vim.fn.fnamemodify(config[1], ":p")
  if config_path ~= nil then
    vim.notify(config_path)
    table.insert(defaults, "--config")
    table.insert(defaults, config_path)
  end

  return defaults
end

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

lspconfig.golangci_lint_ls.setup {
  cmd = (function(debug)
    if debug then
      return { "golangci-lint-langserver", "-debug" }
    end
    return { "golangci-lint-langserver" }
  end)(false),
  init_options = {
    command = golangci_lint_args(),
  },
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
  filetypes = { "go" },
  root_dir = util.root_pattern ".git",
}

lspconfig.buf_ls.setup {
  on_attach = on_attach,
  on_init = on_init,
  capabilities = capabilities,
  filetypes = { "proto" },
  root_dir = util.root_pattern ".git",
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
  settings = {
    tailwindCSS = {
      includeLanguages = {
        templ = "html",
      },
    },
  },
}

lspconfig.ts_ls.setup {
  on_attach = on_attach,
  on_init = on_init,
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
