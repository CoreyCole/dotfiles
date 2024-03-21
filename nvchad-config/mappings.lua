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

local custom_format = function()
  if vim.bo.filetype == "templ" then
    local bufnr = vim.api.nvim_get_current_buf()
    local filename = vim.api.nvim_buf_get_name(bufnr)
    local cmd = "templ fmt " .. vim.fn.shellescape(filename)

    vim.fn.jobstart(cmd, {
      on_exit = function()
        -- Reload the buffer only if it's still the current buffer
        if vim.api.nvim_get_current_buf() == bufnr then
          vim.cmd('e!')
        end
      end,
    })
  else
    vim.lsp.buf.format()
  end
end

vim.cmd("map <S-Down> <Nop>")
vim.cmd("map <S-Up> <Nop>")
M.cc = {
  plugin = false,
  n = {
    ["<leader>wq"] = {
      function()
        require("nvchad.tabufline").close_buffer()
      end,
      "close tab",
    },
    ["<leader>wo"] = {
      function()
        require("nvchad.tabufline").closeOtherBufs()
      end,
      "close other tabs",
    },
    ["<leader>lf"] = {
      function()
        custom_format()
      end,
      "format templ html",
    },
    ["gD"] = {
      function()
        vim.lsp.buf.declaration()
      end,
      "LSP declaration",
    },
    ["gd"] = {
      function()
        require('telescope.builtin').lsp_definitions()
        vim.cmd("norm! zz") -- center the cursor in the screen
      end,
      "LSP definition",
    },
    ["gi"] = {
      function()
        vim.lsp.buf.implementation()
      end,
      "LSP implementation",
    },
    ["<leader>s"] = {
      ":noautocmd w <CR>",
      "Save without auto cmd/formatting",
    },
    ["<leader>mdp"] = {
      ":lua InsertMarkdownURL()<CR>",
      "markdown paste url",
    },
    ["<leader>x"] = {
      ":lua require('trouble').toggle()<CR>",
      "toggle trouble",
    },
    ["<leader>cp"] = {
      ':let @+ = expand("%:p")',
      "Copy full path",
    },
    ["<leader>cpr"] = {
      ':let @+ = expand("%")',
      "Copy relative path",
    },
    ["<leader>cpf"] = {
      ':let @+ = expand("%:t")',
      "Copy filename",
    },
  },
}
M.package_info = {
  n = {
    ["<leader>ns"] = {
      function()
        require("package-info").show()
      end,
      "show package.json virtual text",
    },
    ["<leader>nc"] = {
      function()
        require("package-info").hide()
      end,
      "hide package.json virtual text",
    },
    ["<leader>nt"] = {
      function()
        require("package-info").toggle()
      end,
      "toggle package.json virtual text",
    },
    ["<leader>nu"] = {
      function()
        require("package-info").update()
      end,
      "update package.json on current line",
    },
    ["<leader>nd"] = {
      function()
        require("package-info").delete()
      end,
      "delete package.json on current line",
    },
    ["<leader>ni"] = {
      function()
        require("package-info").install()
      end,
      "install package.json on current line",
    },
    ["<leader>np"] = {
      function()
        require("package-info").change_version()
      end,
      "change package.json version on current line",
    },
  },
}
M.copilot = {
  i = {
    ["<C-l>"] = {
      function()
        vim.fn.feedkeys(vim.fn['copilot#Accept'](), '')
      end,
      "Copilot Accept",
      { replace_keycodes = true, nowait=true, silent=true, expr=true, noremap=true },
    },
    ["<C-j>"] = {
      function()
        vim.fn.feedkeys(vim.fn['copilot#Next'](), '')
      end,
      "Copilot Next",
      { replace_keycodes = true, nowait=true, silent=true, expr=true, noremap=true },
    },
    ["<C-k>"] = {
      function()
        vim.fn.feedkeys(vim.fn['copilot#Previous'](), '')
      end,
      "Copilot Previous",
      { replace_keycodes = true, nowait=true, silent=true, expr=true, noremap=true },
    },
  },
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
  },
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
      "Debug python test method",
    },
  },
}
M.crates = {
  n = {
    ["<leader>rcu"] = {
      function()
        require("crates").upgrade_all_crates()
      end,
      "upgrade all crates",
    },
  },
}

local function format_action(action, options)
    if type(action) == "function" then
        return "function() end" -- Simplification for demonstration; actual function bodies need manual handling
    else
        return "\"" .. action:gsub("\"", "\\\"") .. "\""
    end
end

local function format_options(options)
    if not options or next(options) == nil then
        return "{}"
    end

    local parts = {}
    for k, v in pairs(options) do
        if type(v) == "boolean" then
            v = v and "true" or "false"
        elseif type(v) == "string" then
            v = "\"" .. v:gsub("\"", "\\\"") .. "\""
        end
        table.insert(parts, k .. " = " .. v)
    end
    return "{" .. table.concat(parts, ", ") .. "}"
end

local output_lines = {}
for group_name, group in pairs(M) do
    for mode, mappings in pairs(group) do
        if mode ~= "plugin" then -- Skip the plugin field
            for key, val in pairs(mappings) do
                local action = format_action(val[1], val[3])
                local desc = val[2] and ("\"" .. val[2]:gsub("\"", "\\\"") .. "\"") or "\"\""
                local options = val[3] and format_options(val[3]) or "{}"
                table.insert(output_lines, string.format("vim.keymap.set(\"%s\", \"%s\", %s, { desc = %s, opts = %s })", mode, key, action, desc, options))
            end
        end
    end
end

local file_path = "~/Downloads/mappings.txt"
local file = io.open(file_path, "w")
for _, line in ipairs(output_lines) do
    file:write(line .. "\n")
end
file:close()

return M
