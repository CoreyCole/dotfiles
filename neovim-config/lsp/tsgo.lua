--- npm install @typescript/native-preview

---@type vim.lsp.Config
return {
    cmd = { "tsgo", "--lsp", "--stdio" },
    filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
}
