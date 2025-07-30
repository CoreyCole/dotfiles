require "nvchad.options"

-- ufo options
vim.o.fillchars = [[eob: ,fold: ,foldopen:,foldsep: ,foldclose:]]
vim.o.foldlevel = 99
vim.o.foldlevelstart = 99
vim.o.foldcolumn = "auto:9"

-- Add diagonal lines for diff deletions
vim.opt.fillchars:append({ diff = "╱" })

-- Auto-read files when changed externally
vim.opt.autoread = true

-- Check for file changes more frequently
vim.opt.updatetime = 100

-- Trigger checktime on various events
vim.api.nvim_create_autocmd({ "FocusGained", "BufEnter", "CursorHold", "CursorHoldI" }, {
  pattern = "*",
  command = "checktime",
})
vim.opt.swapfile = false

-- avante recommended
vim.opt.laststatus = 3

vim.api.nvim_set_hl(0, "NeogitDiffDelete", { fg = "#D14242" })
vim.api.nvim_set_hl(0, "NeogitDiffAdd", { fg = "#559955" })
vim.api.nvim_set_hl(0, "NeogitDiffDeleteHighlight", { fg = "#D14242" })
vim.api.nvim_set_hl(0, "NeogitDiffAddHighlight", { fg = "#559955" })

-- Standard diff highlight groups (for regular diffs outside Neogit)
vim.api.nvim_set_hl(0, "DiffAdd", { bg = "#2a3d2a" })
vim.api.nvim_set_hl(0, "DiffDelete", { bg = "#3d2a2a" })
vim.api.nvim_set_hl(0, "DiffChange", { bg = "#3d3d2a" })
vim.api.nvim_set_hl(0, "DiffText", { bg = "#4d4d2a", bold = true })

-- Diffview.nvim highlight groups
vim.api.nvim_set_hl(0, "DiffviewDiffAddAsDelete", { fg = "#808080" })
vim.api.nvim_set_hl(0, "DiffviewDiffDelete", { fg = "#505050" })
vim.api.nvim_set_hl(0, "DiffviewDiffAdd", { bg = "#2a3d2a" })
vim.api.nvim_set_hl(0, "DiffviewDiffChange", { bg = "#3d3d2a" })
vim.api.nvim_set_hl(0, "DiffviewDiffText", { bg = "#4d4d2a", bold = true })

-- Style for deletion placeholder lines (the diagonal lines)
vim.api.nvim_set_hl(0, "DiffviewDim1", { fg = "#404040" })
vim.api.nvim_set_hl(0, "DiffviewFillChar", { fg = "#303030" })

vim.cmd "map <S-Down> <Nop>"
vim.cmd "map <S-Up> <Nop>"
-- local o = vim.o
-- o.cursorlineopt ='both' -- to enable cursorline!
vim.opt.listchars = "tab:▸ ,trail:·,nbsp:␣,extends:❯,precedes:❮" -- show symbols for whitespace
vim.opt.relativenumber = false -- relative line numbers
-- vim.opt.scrolloff = 10 -- keep 20 lines above and below the cursor

vim.g.copilot_no_tab_map = true
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
