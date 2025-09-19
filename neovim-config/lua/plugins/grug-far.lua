-- Find and replace.
return {
    {
        "MagicDuck/grug-far.nvim",
        cmd = "GrugFar",
        keys = {
            {
                "<leader>cg",
                function()
                    local grug = require "grug-far"
                    grug.open { transient = true }
                end,
                desc = "GrugFar",
                mode = { "n", "v" },
            },
            replace = { n = "<localleader>r" },
            qflist = { n = "<localleader>q" },
            syncLocations = { n = "<localleader>s" },
            syncLine = { n = "<localleader>l" },
            close = { n = "<localleader>c" },
            historyOpen = { n = "<localleader>t" },
            historyAdd = { n = "<localleader>a" },
            refresh = { n = "<localleader>f" },
            openLocation = { n = "<localleader>o" },
            openNextLocation = { n = "<down>" },
            openPrevLocation = { n = "<up>" },
            gotoLocation = { n = "<enter>" },
            pickHistoryEntry = { n = "<enter>" },
            abort = { n = "<localleader>b" },
            help = { n = "g?" },
            toggleShowCommand = { n = "<localleader>p" },
            swapEngine = { n = "<localleader>e" },
            previewLocation = { n = "<localleader>i" },
            swapReplacementInterpreter = { n = "<localleader>x" },
            applyNext = { n = "<localleader>j" },
            applyPrev = { n = "<localleader>k" },
        },
        opts = {
            -- Disable folding.
            folding = { enabled = false },
            -- Don't numerate the result list.
            resultLocation = { showNumberLabel = false },
        },
    },
}
