local nnoremap = require("coreycole.maps-helper").nnoremap
local xnoremap = require("coreycole.maps-helper").xnoremap

local Terminal = require("toggleterm.terminal").Terminal
local lazygit = Terminal:new({cmd = "lazygit", hidden = true, close_on_exit = true, direction = "float", float_ops = {winblend = 3}})
local cargo_run_term = Terminal:new({cmd = "cargo run", close_on_exit = false, direction = "float", float_ops = {winblend = 3}})
local cargo_check_term = Terminal:new({cmd = "cargo check", close_on_exit = false, direction = "float", float_ops = {winblend = 3}})
local cargo_test_term = Terminal:new({cmd = "cargo test", close_on_exit = false, direction = "float", float_ops = {winblend = 3}})
local eslint = Terminal:new({cmd = "eslint .", close_on_exit = false, direction = "float", float_ops = {winblend = 3}})

function _lazygit_toggle() lazygit:toggle() end
function _cargo_run_toggle() cargo_run_term:toggle() end
function _cargo_check_toggle() cargo_check_term:toggle() end
function _cargo_test_toggle() cargo_test_term:toggle() end
function _eslint_toggle() eslint:toggle() end
local toggled_types = false;
function _toggle_types()
    if (toggled_types) then
        toggled_types = false
        require("rust-tools").inlay_hints.disable()
    else
        toggled_types = true
        require("rust-tools").inlay_hints.enable()
        vim.cmd("hi def IlluminatedWordText gui=underline")
        vim.cmd("hi def IlluminatedWordRead gui=underline")
        vim.cmd("hi def IlluminatedWordWrite gui=underline")
    end
end

nnoremap("<Tab>", "<Cmd>BufferLineCycleNext<CR>", {})
nnoremap("<S-Tab>", "<Cmd>BufferLineCyclePrev<CR>", {})
nnoremap("<leader>a", "<cmd>:BufferLinePick<cr>")
nnoremap("<leader>v", "<cmd>:NvimTreeFocus<cr>")
nnoremap("<leader>b", "<cmd>:NvimTreeToggle<cr>")
nnoremap("<C-s>", "<cmd>w!<cr>")
--[[ nnoremap("<leader>d", "<plug>(easymotion-bd-f)")
nnoremap("<leader>d", "<plug>(easymotion-overwin-f") ]]
nnoremap("<leader>h", "<cmd>:ClangdSwitchSourceHeader<cr>")
nnoremap("<leader>g", _lazygit_toggle)
nnoremap("<leader>gr", _cargo_run_toggle)
nnoremap("<leader>gc", _cargo_check_toggle)
nnoremap("<leader>gt", _cargo_test_toggle)
nnoremap("<leader>l", _eslint_toggle)
nnoremap("<leader>n", "<cmd>ToggleTerm<cr>")
nnoremap("<leader>xx", "<cmd>TroubleToggle<cr>")
nnoremap("<leader>t", _toggle_types)
nnoremap("<leader>sd", function() vim.lsp.buf.hover() end)
nnoremap("<leader>sf", function() vim.lsp.buf.definition() end)
nnoremap("<C-LeftMouse>", function() vim.lsp.buf.definition() end)
nnoremap("<leader>d", "<C-O>")
nnoremap("<A-LeftMouse>", function()
    vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<esc>", true, false, true), "x", true)
    vim.fn.feedkeys("gf")
end)

nnoremap("<leader>xx", "<cmd>TroubleToggle<cr>")
nnoremap("<leader>xw", "<cmd>TroubleToggle workspace_diagnostics<cr>")
nnoremap("<leader>xd", "<cmd>TroubleToggle document_diagnostics<cr>")
nnoremap("<leader>xq", "<cmd>TroubleToggle quickfix<cr>")
nnoremap("<leader>xl", "<cmd>TroubleToggle loclist<cr>")
nnoremap("gR", "<cmd>TroubleToggle lsp_references<cr>")

nnoremap("<leader>cc", "<Plug>kommentary_line_default", {})
nnoremap("<leader>cic", "<Plug>kommentary_line_increase", {})
nnoremap("<leader>ci", "<Plug>kommentary_motion_increase", {})
nnoremap("<leader>cdc", "<Plug>kommentary_line_decrease", {})
nnoremap("<leader>cd", "<Plug>kommentary_motion_decrease", {})
xnoremap("<leader>cd", "<Plug>kommentary_visual_decrease", {})
xnoremap("<leader>ci", "<Plug>kommentary_visual_increase", {})

