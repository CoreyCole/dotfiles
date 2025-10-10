---@type vim.lsp.Config
return {
    cmd = { "vscode-html-language-server", "--stdio" },
    filetypes = { "html", "templ", "jsx", "tsx", "typescriptreact" },
    root_markers = { "package.json", ".git" },
    init_options = {
        configurationSection = { "html", "css", "javascript" },
        embeddedLanguages = {
            css = true,
            javascript = true,
        },
        provideFormatter = true,
    },
}