return {
    "kndndrj/nvim-dbee",
    event = "VeryLazy",
    dependencies = {
        "MunifTanjim/nui.nvim",
        "MattiasMTS/cmp-dbee",
    },
    build = function()
        -- Install tries to automatically detect the install method.
        -- if it fails, try calling it with one of these parameters:
        --    "curl", "wget", "bitsadmin", "go"
        require("dbee").install()
    end,
    keys = {
        {
            "<leader>dt",
            function()
                require("dbee").toggle()
            end,
            desc = "Toggle DB UI",
        },
        {
            "<leader>do",
            function()
                require("dbee").open()
            end,
            desc = "Open DB UI",
        },
        {
            "<leader>dc",
            function()
                require("dbee").close()
            end,
            desc = "Close DB UI",
        },
        {
            "<leader>de",
            function()
                require("dbee").execute()
            end,
            desc = "Execute DB query",
        },
        {
            "<leader>ds",
            function()
                require("dbee").store("csv", "file", {})
            end,
            desc = "Store DB results",
        },
    },
    config = function()
        require("dbee").setup {
            require("dbee.sources").EnvSource:new "DBEE_CONNECTIONS",
        }
    end,
}
