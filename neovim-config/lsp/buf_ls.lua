---@type vim.lsp.Config
return {
    cmd = { "buf", "beta", "lsp" },
    filetypes = { "proto" },
    root_markers = { "buf.yaml", "buf.gen.yaml", ".git" },
}