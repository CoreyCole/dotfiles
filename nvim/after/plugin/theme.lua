-- vim.cmd([[
-- hi Normal guibg=none ctermbg=none
-- hi NormalNC guibg=none ctermbg=none
-- hi Comment guibg=none ctermbg=none
-- hi Constant guibg=none ctermbg=none
-- hi Special guibg=none ctermbg=none
-- hi Identifier guibg=none ctermbg=none
-- hi Statement guibg=none ctermbg=none
-- hi PreProc guibg=none ctermbg=none
-- hi Type guibg=none ctermbg=none
-- hi Underlined guibg=none ctermbg=none
-- hi Todo guibg=none ctermbg=none
-- hi String guibg=none ctermbg=none
-- hi Function guibg=none ctermbg=none
-- hi Conditional guibg=none ctermbg=none
-- hi Repeat guibg=none ctermbg=none
-- hi Operator guibg=none ctermbg=none
-- hi Structure guibg=none ctermbg=none
-- hi LineNr guibg=none ctermbg=none
-- hi Folded guibg=none ctermbg=none
-- hi NonText guibg=none ctermbg=none
-- hi SpecialKey guibg=none ctermbg=none
-- hi VertSplit guibg=none ctermbg=none
-- hi SignColumn guibg=none ctermbg=none
-- hi EndOfBuffer guibg=none ctermbg=none
-- hi CursorLineNr guibg=none ctermbg=none
-- hi Keyword guibg=none ctermbg=none
-- ]])
vim.cmd([[
set signcolumn=yes
autocmd CursorHold * lua vim.diagnostic.open_float(nil, { focusable = false })
]])
