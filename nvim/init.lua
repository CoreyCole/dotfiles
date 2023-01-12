vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1
vim.opt.termguicolors = true

print('init.lua is loaded!')

-- require('amyjuanli.options')
-- require('amyjuanli.maps')
require('coreycole.plugins')
require('coreycole.set')
require('coreycole.maps-helper')
require('coreycole.maps')
