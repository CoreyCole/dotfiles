vim.g.base46_cache = vim.fn.stdpath "data" .. "/nvchad/base46/"
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- bootstrap lazy and all plugins
local lazypath = vim.fn.stdpath "data" .. "/lazy/lazy.nvim"

if not vim.loop.fs_stat(lazypath) then
  local repo = "https://github.com/folke/lazy.nvim.git"
  vim.fn.system { "git", "clone", "--filter=blob:none", repo, "--branch=stable", lazypath }
end

vim.opt.rtp:prepend(lazypath)

local lazy_config = require "configs.lazy"

-- load plugins
require("lazy").setup({
  {
    "NvChad/NvChad",
    lazy = false,
    branch = "v2.5",
    import = "nvchad.plugins",
    config = function()
      require "options"
    end,
  },

  { import = "plugins" },
}, lazy_config)

-- load theme
dofile(vim.g.base46_cache .. "defaults")
dofile(vim.g.base46_cache .. "statusline")

require "nvchad.autocmds"

vim.schedule(function()
  require "mappings"
end)

local custom_templ_format = {
  format = function(params)
    print "templ fmt"
    local bufnr = params.bufnr or vim.api.nvim_get_current_buf()
    local filename = vim.api.nvim_buf_get_name(bufnr)

    -- Build the command as a list to avoid shell quoting issues.
    local cmd = { "templ", "fmt", filename }

    local job_id = vim.fn.jobstart(cmd, {
      stdout_buffered = true,
      stderr_buffered = true,
      -- The on_exit callback is called when the job finishes.
      on_exit = function(_, exit_code, _)
        vim.schedule(function()
          -- If the buffer is still valid and current, reload it.
          if vim.api.nvim_buf_is_valid(bufnr) and vim.api.nvim_get_current_buf() == bufnr then
            vim.cmd "e!"
          end
          -- Always call the callback so conform knows we're done.
          if params.callback then
            params.callback()
          end
        end)
      end,
    })

    if job_id <= 0 then
      vim.notify("Failed to start templ fmt", vim.log.levels.ERROR)
      if params.callback then
        params.callback()
      end
    end
  end,
}
vim.keymap.set("n", "<leader>tf", function()
  custom_templ_format.format { bufnr = vim.api.nvim_get_current_buf() }
end, { noremap = true, silent = true })
-- format on save
vim.api.nvim_create_autocmd("BufWritePre", {
  pattern = "*",
  callback = function(args)
    local bufnr = args.buf
    if vim.bo[bufnr].filetype == "templ" then
      custom_templ_format.format { bufnr = vim.api.nvim_get_current_buf() }
    else
      require("conform").format { bufnr = args.buf }
    end
  end,
})
