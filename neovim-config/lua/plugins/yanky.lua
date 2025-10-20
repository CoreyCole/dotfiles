-- Better copy/pasting.
return {
    "gbprod/yanky.nvim",
    enabled = false,
    event = { "BufReadPost", "BufNewFile" },
    opts = {
        ring = {
            history_length = 20,
            permanent_wrapper = function()
                return require("yanky.wrappers").remove_carriage_return
            end,
        },
        highlight = { timer = 250 },
    },
    keys = {
        { "p", "<Plug>(YankyPutAfter)", mode = { "n", "x" }, desc = "Put yanked text after cursor" },
        { "P", "<Plug>(YankyPutBefore)", mode = { "n", "x" }, desc = "Put yanked text before cursor" },
        { "=p", "<Plug>(YankyPutAfterLinewise)", desc = "Put yanked text in line below" },
        { "=P", "<Plug>(YankyPutBeforeLinewise)", desc = "Put yanked text in line above" },
        { "[y", "<Plug>(YankyCycleForward)", desc = "Cycle forward through yank history" },
        { "]y", "<Plug>(YankyCycleBackward)", desc = "Cycle backward through yank history" },
        { "y", "<Plug>(YankyYank)", mode = { "n", "x" }, desc = "Yanky yank" },
    },
}
