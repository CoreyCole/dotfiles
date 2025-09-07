local M = {}

local has_in_cwd = function(filename)
    local cwd = vim.fn.getcwd()
    if module_exists "mini.misc" then
        local mini_cwd = require("mini.misc").find_root(0)
        if mini_cwd ~= nil then
            cwd = mini_cwd
        end
    end
    local full_path = vim.fn.expand(cwd .. "/" .. filename)
    return vim.fn.filereadable(full_path) ~= 0
end
M.has_in_cwd = has_in_cwd

return M
