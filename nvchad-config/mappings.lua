local M = {}

function InsertMarkdownURL()
  local url = vim.fn.getreg "+"
  if url == "" then return end
  local cmd = "curl -L " .. vim.fn.shellescape(url) .. " 2>/dev/null"
  local handle = io.popen(cmd)
  if not handle then return end
  local html = handle:read "*a"
  handle:close()
  local title = ""
  local pattern = "<title>(.-)</title>"
  local m = string.match(html, pattern)
  if m then title = m end
  if title ~= "" then
    local markdownLink = "[" .. title .. "](" .. url .. ")"
    vim.api.nvim_command("call append(line('.'), '" .. markdownLink .. "')")
  else
    print("Title not found for link")
  end
end

M.cc = {
  plugin = false,
  n = {
    ["<leader>s"] = {
      ":noautocmd w <CR>",
      "Save without auto cmd/formatting",
    },
    ["<leader>mdp"] = {
      ":lua InsertMarkdownURL()<CR>",
      "markdown paste url",
    },
  }
}
M.dap = {
  plugin = true,
  n = {
    ["<leader>db"] = {
      "<cmd> DapToggleBreakpoint <CR>",
      "Add breakpoint at line",
    },
    ["<leader>dus"] = {
      function()
        local widgets = require("dap.ui.widgets");
        local sidebar = widgets.sidebar(widgets.scopes);
        sidebar.open();
      end,
      "Open debugging sidebar"
    },
  }
}
M.dap_go = {
  plugin = true,
  n = {
    ["<leader>dgt"] = {
      function()
        require("dap-go").debug_test()
      end,
      "Debug go test",
    },
  },
}
M.dap_python = {
  plugin = true,
  n = {
    ["<leader>dpr"] = {
      function()
        require("dap-python").test_method()
      end,
    },
  }
}
M.crates = {
  n = {
    ["<leader>rcu"] = {
      function()
        require("crates").upgrade_all_crates()
      end,
    }
  }
}

return M
