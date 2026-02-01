---@type vim.lsp.Config
return {
    cmd = { "tailwindcss-language-server", "--stdio" },
    filetypes = { "templ", "astro", "javascript", "typescript", "react" },
    root_markers = {
        "tailwind.config.js",
        "tailwind.config.cjs",
        "tailwind.config.mjs",
        "tailwind.config.ts",
        "postcss.config.js",
        "postcss.config.cjs",
        "postcss.config.mjs",
        "postcss.config.ts",
        ".git",
    },
    settings = {
        tailwindCSS = {
            validate = true,
            lint = {
                cssConflict = "warning",
                invalidApply = "error",
                invalidScreen = "error",
                invalidVariant = "error",
                invalidConfigPath = "error",
                invalidTailwindDirective = "error",
                recommendedVariantOrder = "warning",
            },
            classAttributes = { "class", "className", "class:list", "classList", "ngClass" },
            includeLanguages = {
                templ = "html", -- Our custom addition
                eelixir = "html-eex",
                eruby = "erb",
                htmlangular = "html",
            },
        },
    },
    on_new_config = function(new_config, new_root_dir)
        if not new_config.settings then
            new_config.settings = {}
        end
        if not new_config.settings.editor then
            new_config.settings.editor = {}
        end
        if not new_config.settings.editor.tabSize then
            new_config.settings.editor.tabSize = vim.lsp.util.get_effective_tabstop()
        end
    end,
}
