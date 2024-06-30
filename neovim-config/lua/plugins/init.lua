return {
  {
    "stevearc/conform.nvim",
    event = "BufWritePre", -- format on save
    config = function()
      require "configs.conform"
    end,
  },
  {
    "cameron-wags/rainbow_csv.nvim",
    config = true,
    ft = {
      "csv",
      "tsv",
      "csv_semicolon",
      "csv_whitespace",
      "csv_pipe",
      "rfc_csv",
      "rfc_semicolon",
    },
    cmd = {
      "RainbowDelim",
      "RainbowDelimSimple",
      "RainbowDelimQuoted",
      "RainbowMultiDelim",
    },
  },
  -- {
  --   "vhyrro/luarocks.nvim",
  --   priority = 1000,
  --   config = true,
  -- },
  {
    "vhyrro/luarocks.nvim",
    name = "luarocks",
    opts = {
      rocks = { "lua-curl", "nvim-nio", "mimetypes", "xml2lua" },
    },
  },
  -- {
  --   "vhyrro/luarocks.nvim",
  --   branch = "go-away-python",
  --   config = function()
  --     require("luarocks").setup {}
  --   end,
  -- },
  {
    "rest-nvim/rest.nvim",
    ft = "http",
    dependencies = { "luarocks.nvim" },
    config = function()
      require("rest-nvim").setup()
    end,
  },
  -- {
  --   "neovim/pynvim",
  --   ft = "http",
  -- },
  -- {
  --   "BlackLight/nvim-http",
  --   ft = "http",
  -- },
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
        "eslint-lsp",
        "js-debug-adapter",
        "prettier",
        "prettierd",
      },
    },
  },
  {
    "nvim-treesitter/nvim-treesitter",
    cmd = { "TSInstall", "TSBufEnable", "TSBufDisable", "TSModuleInfo" },
    build = ":TSUpdate",
    opts = function()
      return require "configs.treesitter"
    end,
    config = function(_, opts)
      dofile(vim.g.base46_cache .. "syntax")
      require("nvim-treesitter.configs").setup(opts)
    end,
  },
  {
    "hrsh7th/nvim-cmp",
    opts = function()
      local opts = require "configs.cmp"
      local cmp = require "cmp"
      opts.mapping["<Tab>"] = cmp.config.disable
      opts.mapping["<S-Tab>"] = cmp.config.disable
      opts.mapping["<C-S-k>"] = cmp.mapping.select_prev_item {}
      opts.mapping["<C-S-j>"] = cmp.mapping.select_next_item {}
      opts.mapping["<CR>"] = cmp.mapping.close {}
      opts.mapping["<C-y>"] = cmp.mapping.confirm {
        behavior = cmp.ConfirmBehavior.Insert,
        select = true,
      }
      table.insert(opts.sources, { name = "crates" })
      return opts
    end,
  },
  {
    "nvim-tree/nvim-web-devicons",
  },
  {
    "nvim-tree/nvim-tree.lua",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    event = "VeryLazy",
    opts = function()
      return require "configs.nvimtree"
    end,
  },
  {
    "neovim/nvim-lspconfig",
    config = function()
      require "configs.lspconfig"
    end,
  },
  {
    "roberte777/keep-it-secret.nvim",
    config = function()
      return {
        wildcards = { ".*(.env)$", ".*(.env.local)$", ".*(.env.dev)$", ".*(.env.production)$", ".*(.secret)$" },
        enabled = true,
      }
    end,
  },
  {
    "iamcco/markdown-preview.nvim",
    cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
    ft = { "markdown" },
    build = function()
      vim.fn["mkdp#util#install"]()
    end,
  },
  {
    "kylechui/nvim-surround",
    version = "*", -- Use for stability; omit to use `main` branch for the latest features
    event = "VeryLazy",
    config = function()
      require("nvim-surround").setup {
        surrounds = {
          ["c"] = {
            add = function()
              return { { "```" }, { "```" } }
            end,
          },
        },
      }
    end,
  },
  {
    "MunifTanjim/nui.nvim", -- ui component library
  },
  {
    "folke/trouble.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {
      mode = "document_diagnostics",
    },
    cmd = "Trouble",
    keys = {
      {
        "<leader>t",
        "<cmd>Trouble diagnostics toggle<cr>",
        desc = "Diagnostics (Trouble)",
      },
      {
        "<leader>xX",
        "<cmd>Trouble diagnostics toggle filter.buf=0<cr>",
        desc = "Buffer Diagnostics (Trouble)",
      },
      {
        "<leader>cs",
        "<cmd>Trouble symbols toggle focus=false<cr>",
        desc = "Symbols (Trouble)",
      },
      {
        "<leader>cl",
        "<cmd>Trouble lsp toggle focus=false win.position=right<cr>",
        desc = "LSP Definitions / references / ... (Trouble)",
      },
      {
        "<leader>xL",
        "<cmd>Trouble loclist toggle<cr>",
        desc = "Location List (Trouble)",
      },
      {
        "<leader>xQ",
        "<cmd>Trouble qflist toggle<cr>",
        desc = "Quickfix List (Trouble)",
      },
    },
  },
  { "sindrets/diffview.nvim" },
  {
    "NeogitOrg/neogit",
    dependencies = {
      "nvim-lua/plenary.nvim", -- required
      "sindrets/diffview.nvim", -- optional - Diff integration
      "nvim-telescope/telescope.nvim", -- optional
    },
    config = true,
  },
  --
  -- Rust
  --
  {
    "mrcjkb/rustaceanvim",
    version = "^4",
    ft = { "rust" },
    dependencies = "neovim/nvim-lspconfig",
    config = function()
      require "configs.rustaceanvim"
    end,
  },
  {
    "saecki/crates.nvim",
    ft = { "toml" },
    config = function(_, opts)
      local crates = require "crates"
      crates.setup(opts)
      require("cmp").setup.buffer {
        sources = { { name = "crates" } },
      }
      crates.show()
      require("core.utils").load_mappings "crates"
    end,
  },
  {
    "rust-lang/rust.vim",
    ft = "rust",
    init = function()
      vim.g.rustfmt_autosave = 1
    end,
  },
  --
  -- js/ts
  --
  {
    "mfussenegger/nvim-lint",
    event = "VeryLazy",
    config = function()
      require "configs.lint"
    end,
  },
  {
    "vuki656/package-info.nvim",
    dependencies = "MunifTanjim/nui.nvim",
    ft = "json",
    config = function()
      require("package-info").setup()
    end,
  },
  -- {
  --   "mhartington/formatter.nvim",
  --   event = "VeryLazy",
  --   opts = function()
  --     return require "configs.formatter"
  --   end
  -- },

  --
  -- Debugging
  --
  {
    "mfussenegger/nvim-dap",
    -- config = function(_, _)
    --   require("core.utils").load_mappings("dap")
    -- end,
  },
  {
    "nvim-neotest/nvim-nio",
  },
  {
    "rcarriga/nvim-dap-ui",
    dependencies = { "mfussenegger/nvim-dap", "nvim-neotest/nvim-nio" },
    config = function()
      local dap = require "dap"
      local dapui = require "dapui"
      dapui.setup()
      dap.listeners.after.event_initialized["dapui_config"] = function()
        dapui.open()
      end
    end,
  },

  {
    "mfussenegger/nvim-dap-python",
    ft = "python",
    dependencies = {
      "mfussenegger/nvim-dap",
      "rcarriga/nvim-dap-ui",
    },
    config = function(_, _)
      local path = "~/.local/share/nvim/mason/packages/debugpy/venv/bin/python"
      require("dap-python").setup(path)
      -- require("core.utils").load_mappings("dap_python")
    end,
  },
  {
    "leoluz/nvim-dap-go",
    ft = "go",
    dependencies = {
      "mfussenegger/nvim-dap",
      "rcarriga/nvim-dap-ui",
    },
    opts = function()
      return require "configs.formatter"
    end,
  },
  --
  -- AI Plugins
  --
  {
    "github/copilot.vim",
    lazy = false,
    enabled = true,
  },
  -- https://github.com/jackMort/ChatGPT.nvim
  {
    "jackMort/ChatGPT.nvim",
    dependencies = {
      { "MunifTanjim/nui.nvim" },
      { "nvim-lua/plenary.nvim" },
      { "nvim-telescope/telescope.nvim" },
    },
    -- event = "VeryLazy",
    config = function()
      require("chatgpt").setup {
        api_key_cmd = "bw get item b62de22d-e56c-406d-939b-b121013a699c | jq -r '.fields[] | select(.name==\"OPENAI_KEY\") | .value'",
        actions_paths = { "~/dotfiles/chatgpt-actions.json" },
        openai_params = {
          model = "gpt-4",
          max_tokens = 4000,
        },
        openai_edit_params = {
          model = "gpt-3.5-turbo",
          temperature = 0,
          top_p = 1,
          n = 1,
        },
      }
    end,
  },

  -- https://github.com/David-Kunz/gen.nvim
  {
    "David-Kunz/gen.nvim",
    config = function()
      require("gen").model = "codellama"
    end,
  },
  -- {
  --   "zbirenbaum/copilot.lua",
  --   -- enabled = enable_ai,
  --   dependencies = {
  --     "hrsh7th/nvim-cmp",
  --   },
  --   cmd = "Copilot",
  --   build = ":Copilot auth",
  --   event = "InsertEnter",
  --   config = function()
  --     require("copilot").setup({
  --       panel = {
  --         enabled = true,
  --         auto_refresh = true,
  --       },
  --       suggestion = {
  --         enabled = true,
  --         -- use the built-in keymapping for "accept" (<M-l>)
  --         auto_trigger = true,
  --         accept = false, -- disable built-in keymapping
  --       },
  --     })
  --
  --     -- hide copilot suggestions when cmp menu is open
  --     -- to prevent odd behavior/garbled up suggestions
  --     local cmp_status_ok, cmp = pcall(require, "cmp")
  --     if cmp_status_ok then
  --       cmp.event:on("menu_opened", function()
  --         vim.b.copilot_suggestion_hidden = true
  --       end)
  --
  --       cmp.event:on("menu_closed", function()
  --         vim.b.copilot_suggestion_hidden = false
  --       end)
  --     end
  --   end,
  -- },
  -- copilot status in lualine
  -- this is taken from the copilot lazyvim extras at:
  -- https://www.lazyvim.org/plugins/extras/coding.copilot
  -- {
  --   "nvim-lualine/lualine.nvim",
  --   optional = true,
  --   event = "VeryLazy",
  --   opts = function(_, opts)
  --     local Util = require("lazyvim.util")
  --     local colors = {
  --       [""] = Util.ui.fg("Special"),
  --       ["Normal"] = Util.ui.fg("Special"),
  --       ["Warning"] = Util.ui.fg("DiagnosticError"),
  --       ["InProgress"] = Util.ui.fg("DiagnosticWarn"),
  --     }
  --     table.insert(opts.sections.lualine_x, 2, {
  --       function()
  --         local icon = require("lazyvim.config").icons.kinds.Copilot
  --         local status = require("copilot.api").status.data
  --         return icon .. (status.message or "")
  --       end,
  --       cond = function()
  --         local ok, clients = pcall(vim.lsp.get_active_clients, { name = "copilot", bufnr = 0 })
  --         return ok and #clients > 0
  --       end,
  --       color = function()
  --         if not package.loaded["copilot"] then
  --           return
  --         end
  --         local status = require("copilot.api").status.data
  --         return colors[status.status] or colors[""]
  --       end,
  --     })
  --   end,
  -- },
  -- {
  --   "nvimtools/none-ls-extras.nvim",
  -- },
  -- {
  --   "nvimtools/none-ls.nvim", -- community maintained null-ls
  --   ft = {"python", "go"}, -- file type
  --   dependencies = {
  --     "nvimtools/none-ls-extras.nvim",
  --   },
  --   opts = function()
  --     return require "configs.none-ls"
  --   end,
  -- },
}
