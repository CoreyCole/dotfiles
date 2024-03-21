require "nvchad.mappings"

vim.g.copilot_assume_mapped = true
vim.g.copilot_assume_mapped = true;
vim.g.copilot_tab_fallback = "";
vim.opt.listchars = "tab:▸ ,trail:·,nbsp:␣,extends:❯,precedes:❮" -- show symbols for whitespace
vim.opt.relativenumber = false -- relative line numbers
-- vim.opt.scrolloff = 10 -- keep 20 lines above and below the cursor

-- sync with system clipboard
vim.opt.clipboard = "unnamedplus"
if vim.fn.has("wsl") == 1 then
  vim.api.nvim_create_autocmd("TextYankPost", {

    group = vim.api.nvim_create_augroup("Yank", { clear = true }),

    callback = function()
      vim.fn.system("clip.exe", vim.fn.getreg('"'))
    end,
  })
end

vim.g.is_code_private = function()
  local current_dir = vim.fn.getcwd()
  local home_dir = os.getenv("HOME") or os.getenv("USERPROFILE")

  -- if git repo is filed under ~/private, do not allow AI
  local private_path = home_dir .. "/private"
  local is_code_private = string.find(current_dir, private_path) == 1

  if is_code_private then
    return true
  else
    return false
  end
end

local map = vim.keymap.set

vim.cmd("map <S-Down> <Nop>")
vim.cmd("map <S-Up> <Nop>")
map("n", ";", ":", { desc = "CMD enter command mode" })
map('n', '<leader>ds', require('telescope.builtin').lsp_document_symbols, { desc = 'LSP [G]oto [R]eferences' })
map("n", "<leader>nt", function() end, { desc = "toggle package.json virtual text" })
map("n", "<leader>np", function() end, { desc = "change package.json version on current line" })
map("n", "<leader>nu", function() end, { desc = "update package.json on current line" })
map("n", "<leader>ns", function() end, { desc = "show package.json virtual text" })
map("n", "<leader>nd", function() end, { desc = "delete package.json on current line" })
map("n", "<leader>nc", function() end, { desc = "hide package.json virtual text" })
map("n", "<leader>ni", function() end, { desc = "install package.json on current line" })
map("n", "<leader>dpr", function() end, { desc = "Debug python test method" })
map("n", "<leader>dus", function() end, { desc = "Open debugging sidebar" })
map("n", "<leader>db", "<cmd> DapToggleBreakpoint <CR>", { desc = "Add breakpoint at line" })
map("i", "<C-k>", function() end, { desc = "Copilot Previous" })
map("i", "<C-j>", function() end, { desc = "Copilot Next" })
map("i", "<C-l>", function() end, { desc = "Copilot Accept" })
map("n", "<leader>lf", function() end, { desc = "format templ html" })
map("n", "<leader>cp", ":let @+ = expand(\"%:p\")", { desc = "Copy full path" })
map("n", "<leader>wq", function() end, { desc = "close tab" })
map("n", "<leader>cpr", ":let @+ = expand(\"%\")", { desc = "Copy relative path" })
map("n", "gi", function() end, { desc = "LSP implementation" })
map("n", "<leader>cpf", ":let @+ = expand(\"%:t\")", { desc = "Copy filename" })
map("n", "<leader>s", ":noautocmd w <CR>", { desc = "Save without auto cmd/formatting" })
map("n", "gd", function() end, { desc = "LSP definition" })
map("n", "<leader>mdp", ":lua InsertMarkdownURL()<CR>", { desc = "markdown paste url" })
map("n", "<leader>wo", function() end, { desc = "close other tabs" })
map("n", "gD", function() end, { desc = "LSP declaration" })
map("n", "<leader>x", ":lua require('trouble').toggle()<CR>", { desc = "toggle trouble" })
map("n", "<leader>rcu", function() end, { desc = "upgrade all crates" })
map("n", "<leader>dgt", function() end, { desc = "Debug go test" })
