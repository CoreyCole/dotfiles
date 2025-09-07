--@type TreesitterOptions
local options = {
    ensure_installed = {
        "c",
        "lua",
        "vim",
        "vimdoc",
        "query",
        "go",
        "python",
        "html",
        "css",
        "typescript",
        "javascript",
        "tsx",
    },
    auto_install = false,
    highlight = {
        enable = true,
        use_languagetree = true,
    },
    indent = { enable = true },
    autotag = { enable = true },
    context_commentstring = {
        enable = true,
        config = {
            javascript = {
                __default = "// %s",
                jsx_element = "{/* %s */}",
                jsx_fragment = "{/* %s */}",
                jsx_attribute = "// %s",
                comment = "// %s",
            },
            sql = {
                __default = "-- %s",
            },
        },
    },
}

return options
