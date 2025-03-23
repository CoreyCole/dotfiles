local utils = require "utils"

return {
  {
    "MagicDuck/grug-far.nvim",
    event = "VeryLazy",
    config = function()
      require("grug-far").setup {
        -- options, see Configuration section below
        -- there are no required options atm
        -- engine = 'ripgrep' is default, but 'astgrep' can be specified
        keymaps = {
          replace = { n = "<localleader>r" },
          qflist = { n = "<localleader>q" },
          syncLocations = { n = "<localleader>s" },
          syncLine = { n = "<localleader>l" },
          close = { n = "<localleader>c" },
          historyOpen = { n = "<localleader>t" },
          historyAdd = { n = "<localleader>a" },
          refresh = { n = "<localleader>f" },
          openLocation = { n = "<localleader>o" },
          openNextLocation = { n = "<down>" },
          openPrevLocation = { n = "<up>" },
          gotoLocation = { n = "<enter>" },
          pickHistoryEntry = { n = "<enter>" },
          abort = { n = "<localleader>b" },
          help = { n = "g?" },
          toggleShowCommand = { n = "<localleader>p" },
          swapEngine = { n = "<localleader>e" },
          previewLocation = { n = "<localleader>i" },
          swapReplacementInterpreter = { n = "<localleader>x" },
          applyNext = { n = "<localleader>j" },
          applyPrev = { n = "<localleader>k" },
        },
      }
    end,
  },
  {
    "numToStr/Comment.nvim",
    event = "VeryLazy",
    config = function()
      require("Comment").setup {
        pre_hook = require("ts_context_commentstring.integrations.comment_nvim").create_pre_hook(),
      }
    end,
  },
  {
    "JoosepAlviste/nvim-ts-context-commentstring",
    event = "VeryLazy",
    depenenices = {
      "nvim-treesitter/nvim-treesitter",
      "numToStr/Comment.nvim",
    },
    init = function()
      vim.g.skip_ts_context_commentstring_module = true
      require("nvim-treesitter.configs").setup {}
    end,
  },
  {
    "tpope/vim-dadbod",
  },
  {
    "kristijanhusak/vim-dadbod-completion",
  },
  {
    "kristijanhusak/vim-dadbod-ui",
    dependencies = {
      { "tpope/vim-dadbod", lazy = true },
      { "kristijanhusak/vim-dadbod-completion", ft = { "sql", "mysql", "plsql" }, lazy = true }, -- Optional
    },
    cmd = {
      "DBUI",
      "DBUIToggle",
      "DBUIAddConnection",
      "DBUIFindBuffer",
    },
    init = function()
      -- Your DBUI configuration
      vim.g.db_ui_use_nerd_fonts = 1
    end,
  },
  {
    "sebdah/vim-delve",
  },
  {
    "gelguy/wilder.nvim",
    init = function()
      local wilder = require "wilder"
      wilder.setup { modes = { ":", "/", "?" } }
    end,
  },
  {
    "hat0uma/csvview.nvim",
    config = function()
      require("csvview").setup {
        parser = {
          --- The number of lines that the asynchronous parser processes per cycle.
          --- This setting is used to prevent monopolization of the main thread when displaying large files.
          --- If the UI freezes, try reducing this value.
          async_chunksize = 50,
        },
        view = {
          --- minimum width of a column
          min_column_width = 5,

          --- spacing between columns
          spacing = 2,

          --- The display method of the delimiter
          --- "highlight" highlights the delimiter
          --- "border" displays the delimiter with `│`
          --- see `Features` section of the README.
          ---@type "highlight" | "border"
          display_mode = "border",
        },
      }
    end,
  },
  {
    "windwp/nvim-autopairs",
    enabled = false,
  },
  {
    "nvim-telescope/telescope.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      {
        "nvim-telescope/telescope-fzf-native.nvim",
        build = "cmake -S. -Bbuild -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release",
      },
    },
    config = function()
      require("telescope").setup {
        pickers = {
          find_files = {
            theme = "ivy",
          },
        },
      }
      vim.keymap.set("n", "<leader>fd", require("telescope.builtin").find_files)
      vim.keymap.set("n", "<leader>fe", function()
        require("telescope.builtin").find_files {
          cwd = "~/cn/monorepo/frontend",
        }
      end)
    end,
  },
  {
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
          html = { "prettier" },
          c = { "clang-format" },
          cpp = { "clang-format" },
          -- go = { "gofumpt", "goimports-reviser", "golines" },
          go = {
            -- "gofumpt",
            "goimports",
            "gci",
            "golines",
          },
          sh = { "shfmt" },
          yaml = { "yamlfmt" },
          swift = { "swiftformat" },
          html = { "htmlbeautifier" },
          markdown = { "mdformat" },
          proto = { "buf" },
          sql = { "sqlfluff_format", "sqlfluff_fix" },
        },
        format_on_save = {
          -- These options will be passed to conform.format()
          timeout_ms = 2000,
          lsp_fallback = false,
        },
        formatters = {
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
  -- {
  --   "rest-nvim/rest.nvim",
  --   ft = "http",
  --   dependencies = { "luarocks.nvim" },
  --   config = function()
  --     require("rest-nvim").setup()
  --   end,
  -- },
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
        "vtsls",
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
    dependencies = {
      "nvim-treesitter/nvim-treesitter-textobjects",
    },
    opts = function()
      return require "configs.treesitter"
    end,
    config = function(_, opts)
      dofile(vim.g.base46_cache .. "syntax")
      require("nvim-treesitter.configs").setup(opts)
    end,
  },
  {
    "nvim-treesitter/nvim-treesitter-context",
    dependencies = { "nvim-treesitter/nvim-treesitter" },
    event = "VeryLazy",
    opts = function()
      return {
        enable = true, -- Enable this plugin (Can be enabled/disabled later via commands)
        max_lines = 0, -- How many lines the window should span. Values <= 0 mean no limit.
        min_window_height = 0, -- Minimum editor window height to enable context. Values <= 0 mean no limit.
        line_numbers = true,
        multiline_threshold = 20, -- Maximum number of lines to show for a single context
        trim_scope = "outer", -- Which context lines to discard if `max_lines` is exceeded. Choices: 'inner', 'outer'
        mode = "cursor", -- Line used to calculate context. Choices: 'cursor', 'topline'
        -- Separator between context and content. Should be a single character string, like '-'.
        -- When separator is set, the context will only show up when there are at least 2 lines above cursorline.
        separator = nil,
        zindex = 20, -- The Z-index of the context window
        on_attach = nil, -- (fun(buf: integer): boolean) return false to disable attaching
      }
    end,
    config = function(_, opts)
      require("treesitter-context").setup(opts)
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
      table.insert(opts.sources, { name = "supermaven" })
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
  {
    "FabijanZulj/blame.nvim",
    lazy = false,
    config = function()
      require("blame").setup {}
    end,
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
    -- config = function()
    --   require "configs.lint"
    -- end,
    -- after lint is initialized, run this
    init = function()
      require("lint").linters_by_ft = {
        javascript = { "eslint_d" },
        typescript = { "eslint_d" },
        typescriptreact = { "eslint_d" },
        javascriptreact = { "eslint_d" },
        jsx = { "eslint" },
        tsx = { "eslint" },
        json = { "jsonlint" },
        -- go = { "golangcilint" },
        markdown = { "codespell" },
        proto = { "buf_lint" },
        ["*"] = { "codespell" },
      }
      -- require("lint").linters.golangcilint.args = {
      --   "run",
      --   "--tests",
      --   "--build-tags=integration,unit",
      --   "--concurrency=16",
      --   "--max-issues-per-linter=0",
      --   "--max-same-issues=0",
      --   "--out-format=json",
      --   -- "--exclude",
      --   -- '.*declaration of "err" shadows declaration.*',
      --   "--issues-exit-code=0",
      --   "--show-stats=false",
      --   "--print-issued-lines=false",
      --   "--print-linter-name=false",
      --   function()
      --     return vim.fn.fnamemodify(vim.api.nvim_buf_get_name(0), ":h")
      --   end,
      -- }
      vim.api.nvim_create_autocmd({ "BufWritePost" }, {
        callback = function(args)
          require("lint").try_lint()
        end,
      })
      print("golangci args: " .. vim.inspect(require("lint").linters.golangcilint.args))
      require("lint").linters.golangcilint.on_output = function(output, bufnr)
        -- Print the raw output (as a Lua table)
        print("golangci-lint raw output: " .. vim.inspect(output))
        vim.notify("golangci-lint raw output: " .. vim.inspect(output))
        -- Continue processing the output using the default parser
        return require("lint.linters").get_default_on_output()(output, bufnr)
      end
      require("lint").linters.golangcilint.on_stderr = function(output, bufnr)
        print("golangci-lint stderr output: " .. vim.inspect(output))
        vim.notify("golangci-lint stderr output:\n" .. vim.inspect(output))
        return output
      end
      require("lint").linters.eslint_d = {
        cmd = "eslint_d",
        args = function(params)
          -- Try to find eslint config in current file's directory or any parent
          local function find_eslint_config(start_dir)
            local current = start_dir
            while current and current ~= "" do
              local config_path = current .. "/.eslintrc.json"
              if vim.fn.filereadable(config_path) == 1 then
                return config_path
              end
              -- Move up to parent directory
              current = vim.fn.fnamemodify(current, ":h")
              -- Stop if we reach root
              if current == vim.fn.fnamemodify(current, ":h") then
                break
              end
            end
            return nil
          end

          -- Get file's directory
          local file_dir = vim.fn.fnamemodify(params.filename, ":h")
          local config_path = find_eslint_config(file_dir)

          if config_path then
            return { "--format", "json", "--config", config_path, "--stdin", "--stdin-filename" }
          else
            -- Default args if no config found
            return { "--format", "json", "--stdin", "--stdin-filename" }
          end
        end,
        stdin = true,
        append_fname = true,
        stream = "stdout",
        ignore_exitcode = true,
      }
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
  -- DAP setup
  {
    "mfussenegger/nvim-dap",
    event = "VeryLazy",
    keys = {
      {
        "<leader>db",
        function()
          require("dap").toggle_breakpoint()
        end,
        desc = "toggle [d]ebug [b]reakpoint",
      },
      {
        "<leader>dB",
        function()
          require("dap").set_breakpoint(vim.fn.input "Breakpoint condition: ")
        end,
        desc = "[d]ebug [B]reakpoint",
      },
      {
        "<leader>dc",
        function()
          require("dap").continue()
        end,
        desc = "[d]ebug [c]ontinue (start here)",
      },
      {
        "<leader>dC",
        function()
          require("dap").run_to_cursor()
        end,
        desc = "[d]ebug [C]ursor",
      },
      {
        "<leader>dg",
        function()
          require("dap").goto_()
        end,
        desc = "[d]ebug [g]o to line",
      },
      {
        "<leader>do",
        function()
          require("dap").step_over()
        end,
        desc = "[d]ebug step [o]ver",
      },
      {
        "<leader>dO",
        function()
          require("dap").step_out()
        end,
        desc = "[d]ebug step [O]ut",
      },
      {
        "<leader>di",
        function()
          require("dap").step_into()
        end,
        desc = "[d]ebug [i]nto",
      },
      {
        "<leader>dj",
        function()
          require("dap").down()
        end,
        desc = "[d]ebug [j]ump down",
      },
      {
        "<leader>dk",
        function()
          require("dap").up()
        end,
        desc = "[d]ebug [k]ump up",
      },
      {
        "<leader>dl",
        function()
          require("dap").run_last()
        end,
        desc = "[d]ebug [l]ast",
      },
      {
        "<leader>dp",
        function()
          require("dap").pause()
        end,
        desc = "[d]ebug [p]ause",
      },
      {
        "<leader>dr",
        function()
          require("dap").repl.toggle()
        end,
        desc = "[d]ebug [r]epl",
      },
      {
        "<leader>dR",
        function()
          require("dap").clear_breakpoints()
        end,
        desc = "[d]ebug [R]emove breakpoints",
      },
      {
        "<leader>ds",
        function()
          require("dap").session()
        end,
        desc = "[d]ebug [s]ession",
      },
      {
        "<leader>dt",
        function()
          require("dap").terminate()
        end,
        desc = "[d]ebug [t]erminate",
      },
      {
        "<leader>dw",
        function()
          require("dap.ui.widgets").hover()
        end,
        desc = "[d]ebug [w]idgets",
      },
    },
  },
  {
    "nvim-neotest/nvim-nio",
  },
  {
    "leoluz/nvim-dap-go",
    ft = "go",
    dependencies = {
      "mfussenegger/nvim-dap",
      "rcarriga/nvim-dap-ui",
    },
  },
  {
    "nvim-neotest/neotest",
    event = "VeryLazy",
    dependencies = {
      "nvim-neotest/nvim-nio",
      "nvim-lua/plenary.nvim",
      "antoinemadec/FixCursorHold.nvim",
      "nvim-treesitter/nvim-treesitter",

      "nvim-neotest/neotest-plenary",
      "nvim-neotest/neotest-vim-test",

      {
        "fredrikaverpil/neotest-golang",
        dependencies = {
          {
            "leoluz/nvim-dap-go",
            opts = {},
          },
        },
        branch = "main",
      },
    },
    opts = function(_, opts)
      opts.adapters = opts.adapters or {}
      opts.adapters["neotest-golang"] = {
        go_test_args = {
          "-count=1",
          "-tags=integration,unit",
        },
      }
    end,
    config = function()
      require("neotest").setup {
        adapters = {
          require "neotest-golang" {
            go_test_args = {
              "-count=1",
              "-tags=integration,unit",
            },
            go_list_args = {
              "-tags=integration,unit",
            },
            dap_go_opts = {
              delve = {
                build_flags = { "-tags=integration,unit" },
              },
            },
          },
        },
      }
    end,
  },
  -- DAP UI setup
  {
    "rcarriga/nvim-dap-ui",
    event = "VeryLazy",
    dependencies = {
      "nvim-neotest/nvim-nio",
      "mfussenegger/nvim-dap",
    },
    opts = {},
    config = function(_, opts)
      -- setup dap config by VsCode launch.json file
      -- require("dap.ext.vscode").load_launchjs()
      local dap = require "dap"
      local dapui = require "dapui"
      dapui.setup(opts)
      dap.listeners.after.event_initialized["dapui_config"] = function()
        dapui.open {}
      end
      dap.listeners.before.event_terminated["dapui_config"] = function()
        dapui.close {}
      end
      dap.listeners.before.event_exited["dapui_config"] = function()
        dapui.close {}
      end
    end,
    keys = {
      {
        "<leader>du",
        function()
          require("dapui").toggle {}
        end,
        desc = "[d]ap [u]i",
      },
      {
        "<leader>de",
        function()
          require("dapui").eval()
        end,
        desc = "[d]ap [e]val",
      },
    },
  },
  {
    "theHamsta/nvim-dap-virtual-text",
    opts = {},
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
  --
  -- AI Plugins
  --
  -- {
  --   "github/copilot.vim",
  --   lazy = false,
  --   enabled = true,
  -- },
  {
    "supermaven-inc/supermaven-nvim",
    event = "VeryLazy",
    config = function()
      require("supermaven-nvim").setup {
        keymaps = {
          accept_suggestion = "<C-l>",
          clear_suggestion = "<C-]>",
          accept_word = "<C-j>",
        },
        ignore_filetypes = { cpp = true }, -- or { "cpp", }
        color = {
          suggestion_color = "#ffffff",
          cterm = 244,
        },
        log_level = "info", -- set to "off" to disable logging completely
        disable_inline_completion = false, -- disables inline completion for use with cmp
        disable_keymaps = false, -- disables built in keymaps for more manual control
        condition = function()
          return false
        end, -- condition to check for stopping supermaven, `true` means to stop supermaven when the condition is true.
      }
    end,
  },
  {
    "yetone/avante.nvim",
    event = "VeryLazy",
    version = false, -- Set this to "*" to always pull the latest release version, or set it to false to update to the latest code changes.
    opts = {
      -- add any opts here
      -- for example
      provider = "claude",
      claude = {
        endpoint = "https://api.anthropic.com",
        model = "claude-3-7-sonnet-20250219",
        timeout = 30000, -- Timeout in milliseconds
        temperature = 0,
        max_tokens = 20480,
      },
    },
    -- if you want to build from source then do `make BUILD_FROM_SOURCE=true`
    build = "make",
    -- build = "powershell -ExecutionPolicy Bypass -File Build.ps1 -BuildFromSource false" -- for windows
    dependencies = {
      "nvim-treesitter/nvim-treesitter",
      "stevearc/dressing.nvim",
      "nvim-lua/plenary.nvim",
      "MunifTanjim/nui.nvim",
      --- The below dependencies are optional,
      "echasnovski/mini.pick", -- for file_selector provider mini.pick
      "nvim-telescope/telescope.nvim", -- for file_selector provider telescope
      "hrsh7th/nvim-cmp", -- autocompletion for avante commands and mentions
      "ibhagwan/fzf-lua", -- for file_selector provider fzf
      "nvim-tree/nvim-web-devicons", -- or echasnovski/mini.icons
      "zbirenbaum/copilot.lua", -- for providers='copilot'
      {
        -- support for image pasting
        "HakonHarnes/img-clip.nvim",
        event = "VeryLazy",
        opts = {
          -- recommended settings
          default = {
            embed_image_as_base64 = false,
            prompt_for_file_name = false,
            drag_and_drop = {
              insert_mode = true,
            },
            -- required for Windows users
            use_absolute_path = true,
          },
        },
      },
      {
        -- Make sure to set this up properly if you have lazy=true
        "MeanderingProgrammer/render-markdown.nvim",
        opts = {
          file_types = { "markdown", "Avante" },
        },
        ft = { "markdown", "Avante" },
      },
    },
  },
  -- https://github.com/jackMort/ChatGPT.nvim
  {
    "jackMort/ChatGPT.nvim",
    dependencies = {
      { "MunifTanjim/nui.nvim" },
      { "nvim-lua/plenary.nvim" },
      { "nvim-telescope/telescope.nvim" },
    },
    cmd = { "ChatGPT", "ChatGPTActAs", "ChatGPTRun", "ChatGPTEditWithInstructions" },
    config = function()
      require("chatgpt").setup {
        api_key_cmd = "ks show openai",
        actions_paths = { "~/dotfiles/chatgpt-actions.json" },
        openai_params = {
          model = "gpt-4",
          max_tokens = 4000,
          frequency_penalty = 0,
          presence_penalty = 0,
          temperature = 0.2,
          top_p = 0.1,
          n = 1,
        },
        openai_edit_params = {
          model = "gpt-4",
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
