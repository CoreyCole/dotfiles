---@type vim.lsp.Config
return {
    cmd = { "typescript-language-server", "--stdio" },
    filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
    root_markers = { "package.json", "tsconfig.json", "jsconfig.json", ".git" },
    init_options = {
        hostInfo = "neovim",
    },
    settings = {
        completions = {
            completeFunctionCalls = true,
        },
    },
}