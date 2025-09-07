local on_attach = require("nvchad.configs.lspconfig").on_attach
local on_init = require("nvchad.configs.lspconfig").on_init
local capabilities = require("nvchad.configs.lspconfig").capabilities

vim.g.rustaceanvim = {
    server = {
        on_attach = on_attach,
        on_init = on_init,
        capabilities = capabilities,
    },
}
