require "nvchad.mappings"
local map = vim.keymap.set

map("n", "<leader>s", ":noautocmd w <CR>", { desc = "Save without auto cmd/formatting" })
map("n", ";", ":", { desc = "CMD enter command mode" })
map("n", "<leader>cp", ':let @+ = expand("%:p")', { desc = "Copy full path" })
map("n", "<leader>x", ":lua require('trouble').toggle()<CR>", { desc = "toggle trouble" })

--
-- lsp
--
map("n", "gi", function()
  vim.lsp.buf.implementation()
end, { desc = "LSP implementation" })

map("n", "gd", function()
  require("telescope.builtin").lsp_definitions()
  vim.cmd "norm! zz" -- center the cursor in the screen
end, { desc = "LSP definition" })

map("n", "gD", function()
  vim.lsp.buf.declaration()
end, { desc = "LSP declaration" })

map("n", "<leader>ds", require("telescope.builtin").lsp_document_symbols, { desc = "LSP [G]oto [R]eferences" })

--
-- neogit
--
map("n", "<leader>gg", function()
  require("neogit").open()
end, { desc = "Open Neogit" })
map("n", "<leader>gc", function()
  require("neogit").open { "commit" }
end, { desc = "open commit popup" })
-- open with split
map("n", "<leader>gs", function()
  require("neogit").open { kind = "split" }
end, { desc = "Open Neogit split" })
map("n", "<leader>gd", ":DiffviewOpen<CR>", { desc = "Open DiffView" })
map("n", "<leader>gh", ":DiffviewFileHistory %<CR>", { desc = "Open DiffView File History for current file" })

--
-- rust
--
local bufnr = vim.api.nvim_get_current_buf()
map("n", "<leader>a", function()
  vim.cmd.RustLsp "codeAction" -- supports rust-analyzer's grouping
  -- or vim.lsp.buf.codeAction() if you don't want grouping.
end, { silent = true, buffer = bufnr })
map("n", "<leader>rcu", function()
  require("crates").update_all_crates()
end, { desc = "upgrade all crates" })

--
-- package.json
--
map("n", "<leader>ns", function()
  require("package-info").show()
end, { desc = "show package.json virtual text" })

map("n", "<leader>nc", function()
  require("package-info").hide()
end, { desc = "hide package.json virtual text" })

map("n", "<leader>nt", function()
  require("package-info").toggle()
end, { desc = "toggle package.json virtual text" })

map("n", "<leader>np", function()
  require("package-info").change_version()
end, { desc = "change package.json version on current line" })

map("n", "<leader>nu", function()
  require("package-info").update()
end, { desc = "update package.json on current line" })

map("n", "<leader>ni", function()
  require("package-info").install()
end, { desc = "install package.json on current line" })

-- dap
map("n", "<leader>dus", function()
  local widgets = require "dap.ui.widgets"
  local sidebar = widgets.sidebar(widgets.scopes)
  sidebar.open()
end, { desc = "Open debugging sidebar" })

map("n", "<leader>db", "<cmd> DapToggleBreakpoint <CR>", { desc = "Add breakpoint at line" })

-- go
map("n", "<leader>dgt", function()
  require("dap-go").test()
end, { desc = "Debug go test" })

-- python
map("n", "<leader>dpr", function()
  require("dap-python").test_method()
end, { desc = "Debug python test method" })

-- copilot
vim.g.copilot_assume_mapped = true
vim.g.copilot_tab_fallback = ""
map("i", "<C-l>", function()
  vim.fn.feedkeys(vim.fn["copilot#Accept"](), "")
end, { desc = "Copilot Accept" })

map("i", "<C-k>", function()
  vim.fn.feedkeys(vim.fn["copilot#Previous"](), "")
end, { desc = "Copilot Previous" })

map("i", "<C-j>", function()
  vim.fn.feedkeys(vim.fn["copilot#Next"](), "")
end, { desc = "Copilot Next" })

--
-- nvchad tabufline
--
map("n", "<leader>wq", function()
  require("nvchad.tabufline").close_buffer()
end, { desc = "close tab" })

map("n", "<leader>wo", function()
  require("nvchad.tabufline").closeOtherBufs()
end, { desc = "close other tabs" })

--
-- paths
--
map("n", "<leader>cp", ':let @+ = expand("%:p")', { desc = "Copy full path" })
map("n", "<leader>cpr", ':let @+ = expand("%")', { desc = "Copy relative path" })
map("n", "<leader>cpf", ':let @+ = expand("%:t")', { desc = "Copy filename" })

--
-- markdown
--
function InsertMarkdownURL()
  local url = vim.fn.getreg "+"
  if url == "" then
    return
  end
  local cmd = "curl -L " .. vim.fn.shellescape(url) .. " 2>/dev/null"
  local handle = io.popen(cmd)
  if not handle then
    return
  end
  local html = handle:read "*a"
  handle:close()
  local title = ""
  local pattern = "<title>(.-)</title>"
  local m = string.match(html, pattern)
  if m then
    title = m
  end
  if title ~= "" then
    local markdownLink = "[" .. title .. "](" .. url .. ")"
    vim.api.nvim_command("call append(line('.'), '" .. markdownLink .. "')")
  else
    print "Title not found for link"
  end
end
map("n", "<leader>mdp", ":lua InsertMarkdownURL()<CR>", { desc = "markdown paste url" })

--
-- templ
--
local custom_format = function()
  if vim.bo.filetype == "templ" then
    local bufnr = vim.api.nvim_get_current_buf()
    local filename = vim.api.nvim_buf_get_name(bufnr)
    local cmd = "templ fmt " .. vim.fn.shellescape(filename)
    vim.fn.jobstart(cmd, {
      on_exit = function()
        -- Reload the buffer only if it's still the current buffer
        if vim.api.nvim_get_current_buf() == bufnr then
          vim.cmd "e!"
        end
      end,
    })
  else
    vim.lsp.buf.format()
  end
end
map("n", "<leader>lf", function()
  custom_format()
end, { desc = "format templ html" })
