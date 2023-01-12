vim.g.mapleader = " "
vim.g.vim_json_conceal = 0
vim.g.markdown_syntax_conceal = 0
vim.api.nvim_set_option("updatetime", 300)

local opt = vim.opt
-- opt.guicursor = ""
opt.guicursor = "n-v-c-sm:block,i-ci-ve:ver25,r-cr-o:hor20"
opt.nu = true
opt.relativenumber = true
opt.tabstop = 4
opt.softtabstop = 4
opt.shiftwidth = 4
opt.expandtab = true
opt.hlsearch = false
opt.incsearch = true
opt.smartindent = true
opt.wrap = false
opt.clipboard = "unnamedplus" -- allows neovim to access the system clipboard
opt.conceallevel = 0 -- so that `` is visible in markdown files
format_on_save = true
scrolloff = 10
conceallevel = 0
opt.termguicolors = true

-- spell suggestions
opt.spell = true
opt.spelllang = {"en_us"}

-- Set completeopt to have a better completion experience
-- :help completeopt
-- menuone: popup even when there's only one match
-- noinsert: Do not insert text until a selection is made
-- noselect: Do not select, force to select one from the menu
-- shortness: avoid showing extra messages when using completion
-- updatetime: set updatetime for CursorHold
opt.completeopt = {"menuone", "noselect", "noinsert"}
opt.shortmess = opt.shortmess + {c = true}

-- amyjuanli
opt.title = true
opt.autoindent = true
opt.smartindent = true
opt.hlsearch = true
opt.backup = false
opt.showcmd = true
opt.cmdheight = 1
opt.laststatus = 2
opt.expandtab = true
opt.scrolloff = 10
opt.linebreak = true -- Stop words being broken on wrap
opt.shiftwidth = 4
opt.tabstop = 4
opt.path:append{"**"} -- Finding files - Search down into subfolders
