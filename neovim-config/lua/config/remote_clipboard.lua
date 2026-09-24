-- Herdr forwards OSC 52 from a pane app to the viewing client's clipboard.
-- pbcopy would write the machine where Neovim runs, which is the remote
-- machine when the local Herdr client is attached over SSH.
-- Tmux-only SSH also uses OSC 52; tmux `set-clipboard on` forwards it.
local M = {}

local function in_herdr()
    return vim.env.HERDR_ENV ~= nil or vim.env.HERDR_PANE_ID ~= nil
end

function M.setup()
    if in_herdr() or vim.env.SSH_TTY or vim.env.SSH_CONNECTION then
        vim.g.clipboard = "osc52"
    end
end

return M
