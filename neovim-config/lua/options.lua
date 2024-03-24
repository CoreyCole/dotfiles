require "nvchad.options"

-- add yours here!
vim.cmd "map <S-Down> <Nop>"
vim.cmd "map <S-Up> <Nop>"
-- local o = vim.o
-- o.cursorlineopt ='both' -- to enable cursorline!
vim.opt.listchars = "tab:▸ ,trail:·,nbsp:␣,extends:❯,precedes:❮" -- show symbols for whitespace
vim.opt.relativenumber = false -- relative line numbers
-- vim.opt.scrolloff = 10 -- keep 20 lines above and below the cursor

vim.g.copilot_assume_mapped = true
vim.g.copilot_tab_fallback = ""
vim.opt.listchars = "tab:▸ ,trail:·,nbsp:␣,extends:❯,precedes:❮" -- show symbols for whitespace
vim.opt.relativenumber = false -- relative line numbers
-- vim.opt.scrolloff = 10 -- keep 20 lines above and below the cursor

-- sync with system clipboard
vim.opt.clipboard = "unnamedplus"
if vim.fn.has "wsl" == 1 then
  vim.api.nvim_create_autocmd("TextYankPost", {

    group = vim.api.nvim_create_augroup("Yank", { clear = true }),

    callback = function()
      vim.fn.system("clip.exe", vim.fn.getreg '"')
    end,
  })
end

vim.g.is_code_private = function()
  local current_dir = vim.fn.getcwd()
  local home_dir = os.getenv "HOME" or os.getenv "USERPROFILE"

  -- if git repo is filed under ~/private, do not allow AI
  local private_path = home_dir .. "/private"
  local is_code_private = string.find(current_dir, private_path) == 1

  if is_code_private then
    return true
  else
    return false
  end
end
