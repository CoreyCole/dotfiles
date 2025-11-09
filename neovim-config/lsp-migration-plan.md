# LSP Migration Plan: lspconfig to Native vim.lsp.config

## Overview

This document outlines the migration from nvim-lspconfig plugin to native Neovim LSP configuration using `vim.lsp.config`. The goal is to create individual LSP configuration files in the `neovim-config/lsp/` directory that replicate and extend the default lspconfig settings.

**Key Simplification:** All 10 LSP servers can use the simple `root_markers` array for root detection. No complex functions needed!

## Migration Strategy

### 1. Directory Structure

```
neovim-config/
├── lua/
│   ├── lsp.lua                 # Main LSP setup (already exists)
│   └── plugins/
│       └── lspconfig.lua        # Current config (to be deprecated)
└── lsp/                         # New directory for native configs
    ├── lua_ls.lua
    ├── cssls.lua
    ├── pyright.lua
    ├── gopls.lua
    ├── golangci_lint_ls.lua
    ├── buf_ls.lua
    ├── templ.lua
    ├── tailwindcss.lua
    ├── sqls.lua
    └── ts_go.lua
```

### 2. Root Detection Strategy

Native vim.lsp.config supports simple root detection using `root_markers`. This is much simpler than complex functions:

- Just provide a list of file/directory names to search for
- The LSP will automatically search upward from the current file
- Falls back to current working directory if no markers are found

## Detailed Migration for Each LSP

### 1. `lua_ls.lua` - Lua Language Server

**Default Config:**

- cmd: `{ 'lua-language-server' }`
- filetypes: `{ 'lua' }`
- root_dir: Multiple patterns (`.luarc.json`, `.stylua.toml`, etc.)
- single_file_support: `true`

**Our Customizations:** None (using defaults)

**Migration File (`lsp/lua_ls.lua`):**

```lua
return {
    cmd = { 'lua-language-server' },
    filetypes = { 'lua' },
    root_markers = {
        '.luarc.json', '.luarc.jsonc', '.luacheckrc',
        '.stylua.toml', 'stylua.toml', 'selene.toml',
        'selene.yml', '.git'
    },
    single_file_support = true,
    log_level = vim.lsp.protocol.MessageType.Warning,
    settings = {},
    capabilities = capabilities, -- Will be injected from main setup
}
```

### 2. `cssls.lua` - CSS Language Server

**Default Config:**

- cmd: `{ 'vscode-css-language-server', '--stdio' }`
- filetypes: `{ 'css', 'scss', 'less' }`
- settings: Validation for css, scss, less

**Our Customizations:** None (using defaults)

**Migration File (`lsp/cssls.lua`):**

```lua
return {
    cmd = { 'vscode-css-language-server', '--stdio' },
    filetypes = { 'css', 'scss', 'less' },
    root_markers = { 'package.json', '.git' },
    single_file_support = true,
    init_options = { provideFormatter = true },
    settings = {
        css = { validate = true },
        scss = { validate = true },
        less = { validate = true }
    },
    capabilities = capabilities,
}
```

### 3. `pyright.lua` - Python Type Checker

**Default Config:**

- cmd: `{ 'pyright-langserver', '--stdio' }`
- filetypes: `{ 'python' }`
- root_dir: Multiple Python project files
- settings: Analysis settings

**Our Customizations:**

- filetypes: `{ 'python' }` (same as default)

**Migration File (`lsp/pyright.lua`):**

```lua
return {
    cmd = { 'pyright-langserver', '--stdio' },
    filetypes = { 'python' },
    root_markers = {
        'pyproject.toml', 'setup.py', 'setup.cfg',
        'requirements.txt', 'Pipfile', 'pyrightconfig.json', '.git'
    },
    single_file_support = true,
    settings = {
        python = {
            analysis = {
                autoSearchPaths = true,
                useLibraryCodeForTypes = true,
                diagnosticMode = 'openFilesOnly',
            }
        }
    },
    capabilities = capabilities,
    -- Note: Commands (PyrightOrganizeImports, PyrightSetPythonPath) can be added in on_attach
}
```

### 4. `gopls.lua` - Go Language Server

**Default Config:**

- cmd: `{ 'gopls' }`
- filetypes: `{ 'go', 'gomod', 'gowork', 'gotmpl' }`
- root_dir: Pattern for go.work, go.mod, .git

**Our Customizations:**

- flags: `{ debounce_text_changes = 200 }`
- Extensive settings for analyses, codelenses, hints
- buildFlags: `{ '-tags=integration,unit,e2e' }`

**Migration File (`lsp/gopls.lua`):**

```lua
return {
    cmd = { 'gopls' },
    filetypes = { 'go', 'gomod', 'gowork', 'gotmpl' },
    root_markers = { 'go.work', 'go.mod', '.git' },
    single_file_support = true,
    flags = { debounce_text_changes = 200 },
    settings = {
        gopls = {
            usePlaceholders = true,
            gofumpt = true,
            analyses = {
                nilness = true,
                unusedparams = true,
                unusedwrite = true,
                unusedvariable = true,
                useany = true,
                shadow = false,
            },
            codelenses = {
                gc_details = true,
                generate = true,
                regenerate_cgo = true,
                run_govulncheck = true,
                test = true,
                tidy = true,
                upgrade_dependency = true,
                vendor = true,
            },
            experimentalPostfixCompletions = true,
            completeUnimported = true,
            staticcheck = true,
            directoryFilters = { '-.git', '-node_modules' },
            semanticTokens = true,
            symbolScope = 'all',
            hints = {
                assignVariableTypes = true,
                compositeLiteralFields = true,
                compositeLiteralTypes = true,
                constantValues = true,
                functionTypeParameters = true,
                parameterNames = true,
                rangeVariableTypes = true,
            },
            buildFlags = { '-tags=integration,unit,e2e' },
        }
    },
    capabilities = capabilities,
}
```

### 5. `golangci_lint_ls.lua` - Go Linter Language Server

**Default Config:**

- cmd: `{ 'golangci-lint-langserver' }`
- filetypes: `{ 'go', 'gomod' }`
- init_options: Basic golangci-lint command
- before_init: Version detection logic

**Our Customizations:**

- Custom command function with debug support
- init_options: Complex golangci_lint_args function with config detection
- Build tags: `integration,unit`

**Migration File (`lsp/golangci_lint_ls.lua`):**

```lua
local function golangci_lint_args()
    local defaults = {
        'golangci-lint',
        'run',
        '--fix',
        '--output.json.path=stdout',
        -- Overwrite values possibly set in .golangci.yml
        '--output.text.path=',
        '--output.tab.path=',
        '--output.html.path=',
        '--output.checkstyle.path=',
        '--output.code-climate.path=',
        '--output.junit-xml.path=',
        '--output.teamcity.path=',
        '--output.sarif.path=',
        '--show-stats=false',
        '--build-tags=integration,unit',
    }

    local config = vim.fs.find(
        { '.golangci.yml' },
        { path = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(0), ':p:h'), upward = true }
    )
    if #config > 0 then
        local config_path = vim.fn.fnamemodify(config[1], ':p')
        table.insert(defaults, '--config')
        table.insert(defaults, config_path)
    end

    return defaults
end

return {
    cmd = { 'golangci-lint-langserver' },  -- Debug flag can be added dynamically if needed
    filetypes = { 'go', 'gomod' },
    root_markers = {
        '.golangci.yml', '.golangci.yaml', '.golangci.toml',
        '.golangci.json', 'go.work', 'go.mod', '.git'
    },
    init_options = {
        command = golangci_lint_args(),
    },
    -- Version detection can be done in before_init if needed
    before_init = function(params, config)
        -- Detect golangci-lint version and adjust command if needed
        local version_output = vim.fn.system('golangci-lint version --format short')
        local major = version_output:match('(%d+)%.')
        if major and tonumber(major) < 2 then
            -- Adjust for v1 compatibility
            local cmd = config.init_options.command
            for i, arg in ipairs(cmd) do
                if arg:find('^%-%-output%.') then
                    cmd[i] = nil
                end
            end
        end
    end,
    capabilities = capabilities,
}
```

### 6. `buf_ls.lua` - Protobuf Language Server

**Default Config:**

- cmd: `{ 'buf', 'beta', 'lsp', '--timeout=0', '--log-format=text' }`
- filetypes: `{ 'proto' }`

**Our Customizations:** None (using defaults)

**Migration File (`lsp/buf_ls.lua`):**

```lua
return {
    cmd = { 'buf', 'beta', 'lsp', '--timeout=0', '--log-format=text' },
    filetypes = { 'proto' },
    root_markers = { 'buf.yaml', '.git' },
    capabilities = capabilities,
}
```

### 7. `templ.lua` - Templ HTML Templating

**Default Config:**

- cmd: `{ 'templ', 'lsp' }`
- filetypes: `{ 'templ' }`

**Our Customizations:** None (using defaults)

**Migration File (`lsp/templ.lua`):**

```lua
return {
    cmd = { 'templ', 'lsp' },
    filetypes = { 'templ' },
    root_markers = { 'go.work', 'go.mod', '.git' },
    capabilities = capabilities,
}
```

### 8. `tailwindcss.lua` - Tailwind CSS Language Server

**Default Config:**

- cmd: `{ 'tailwindcss-language-server', '--stdio' }`
- filetypes: Extensive list
- settings: Comprehensive lint and validation settings

**Our Customizations:**

- filetypes: `{ 'templ', 'astro', 'javascript', 'typescript', 'react' }`
- settings.includeLanguages: `{ templ = 'html' }`

**Migration File (`lsp/tailwindcss.lua`):**

```lua
return {
    cmd = { 'tailwindcss-language-server', '--stdio' },
    filetypes = { 'templ', 'astro', 'javascript', 'typescript', 'react' },
    root_markers = {
        'tailwind.config.js', 'tailwind.config.cjs',
        'tailwind.config.mjs', 'tailwind.config.ts',
        'postcss.config.js', 'postcss.config.cjs',
        'postcss.config.mjs', 'postcss.config.ts',
        '.git'
    },
    settings = {
        tailwindCSS = {
            validate = true,
            lint = {
                cssConflict = 'warning',
                invalidApply = 'error',
                invalidScreen = 'error',
                invalidVariant = 'error',
                invalidConfigPath = 'error',
                invalidTailwindDirective = 'error',
                recommendedVariantOrder = 'warning',
            },
            classAttributes = { 'class', 'className', 'class:list', 'classList', 'ngClass' },
            includeLanguages = {
                templ = 'html',  -- Our custom addition
                eelixir = 'html-eex',
                eruby = 'erb',
                htmlangular = 'html',
            }
        }
    },
    on_new_config = function(new_config, new_root_dir)
        if not new_config.settings then new_config.settings = {} end
        if not new_config.settings.editor then new_config.settings.editor = {} end
        if not new_config.settings.editor.tabSize then
            new_config.settings.editor.tabSize = vim.lsp.util.get_effective_tabstop()
        end
    end,
    capabilities = capabilities,
}
```

### 9. `sqls.lua` - SQL Language Server

**Default Config:**

- cmd: `{ 'sqls' }`
- filetypes: `{ 'sql', 'mysql' }`
- root_dir: `config.yml` pattern

**Our Customizations:**

- cmd: `{ '/usr/local/go/bin/sqls' }` (specific path)
- root_dir: Changed to use git ancestor or cwd
- Special on_attach with commands and keymaps
- autostart: true
- Force start on FileType

**Migration File (`lsp/sqls.lua`):**

```lua
return {
    cmd = { '/usr/local/go/bin/sqls' },
    filetypes = { 'sql', 'mysql' },
    root_markers = { '.git' },  -- Simplified from function
    single_file_support = true,
    autostart = true,
    settings = {},
    capabilities = capabilities,
    on_attach = function(client, bufnr)
        -- Enable executeCommand and codeAction capabilities
        client.server_capabilities.executeCommandProvider = true
        client.server_capabilities.codeActionProvider = { resolveProvider = false }

        -- Define commands
        client.commands = {
            executeQuery = function(_, client)
                require('sqls.commands').exec(client.client_id, 'executeQuery')
            end,
            showDatabases = function(_, client)
                require('sqls.commands').exec(client.client_id, 'showDatabases')
            end,
            showSchemas = function(_, client)
                require('sqls.commands').exec(client.client_id, 'showSchemas')
            end,
            showConnections = function(_, client)
                require('sqls.commands').exec(client.client_id, 'showConnections')
            end,
            showTables = function(_, client)
                require('sqls.commands').exec(client.client_id, 'showTables')
            end,
            describeTable = function(_, client)
                require('sqls.commands').exec(client.client_id, 'describeTable')
            end,
            switchConnections = function(_, client)
                require('sqls.commands').switch_connection(client.client_id)
            end,
            switchDatabase = function(_, client)
                require('sqls.commands').switch_database(client.client_id)
            end,
        }

        -- Create user commands
        local client_id = client.id
        vim.api.nvim_buf_create_user_command(bufnr, 'SqlsExecuteQuery', function(args)
            require('sqls.commands').exec(client_id, 'executeQuery', args.smods, args.range ~= 0, nil, args.line1, args.line2)
        end, { range = true })

        vim.api.nvim_buf_create_user_command(bufnr, 'SqlsExecuteQueryVertical', function(args)
            require('sqls.commands').exec(client_id, 'executeQuery', args.smods, args.range ~= 0, '-show-vertical', args.line1, args.line2)
        end, { range = true })

        vim.api.nvim_buf_create_user_command(bufnr, 'SqlsShowDatabases', function(args)
            require('sqls.commands').exec(client_id, 'showDatabases', args.smods)
        end, {})

        vim.api.nvim_buf_create_user_command(bufnr, 'SqlsShowSchemas', function(args)
            require('sqls.commands').exec(client_id, 'showSchemas', args.smods)
        end, {})

        vim.api.nvim_buf_create_user_command(bufnr, 'SqlsShowConnections', function(args)
            require('sqls.commands').exec(client_id, 'showConnections', args.smods)
        end, {})

        vim.api.nvim_buf_create_user_command(bufnr, 'SqlsShowTables', function(args)
            require('sqls.commands').exec(client_id, 'showTables', args.smods)
        end, {})

        vim.api.nvim_buf_create_user_command(bufnr, 'SqlsSwitchDatabase', function(args)
            require('sqls.commands').switch_database(client_id, args.args ~= '' and args.args or nil)
        end, { nargs = '?' })

        vim.api.nvim_buf_create_user_command(bufnr, 'SqlsSwitchConnection', function(args)
            require('sqls.commands').switch_connection(client_id, args.args ~= '' and args.args or nil)
        end, { nargs = '?' })

        -- Set up keymaps
        vim.api.nvim_buf_set_keymap(bufnr, 'n', '<Plug>(sqls-execute-query)',
            "<Cmd>let &opfunc='{type -> sqls_nvim#query(type, " .. client_id .. ")}'<CR>g@",
            { silent = true })
        vim.api.nvim_buf_set_keymap(bufnr, 'x', '<Plug>(sqls-execute-query)',
            "<Cmd>let &opfunc='{type -> sqls_nvim#query(type, " .. client_id .. ")}'<CR>g@",
            { silent = true })
        vim.api.nvim_buf_set_keymap(bufnr, 'n', '<Plug>(sqls-execute-query-vertical)',
            "<Cmd>let &opfunc='{type -> sqls_nvim#query_vertical(type, " .. client_id .. ")}'<CR>g@",
            { silent = true })
        vim.api.nvim_buf_set_keymap(bufnr, 'x', '<Plug>(sqls-execute-query-vertical)',
            "<Cmd>let &opfunc='{type -> sqls_nvim#query_vertical(type, " .. client_id .. ")}'<CR>g@",
            { silent = true })

        -- Additional keymaps
        local opts = { noremap = true, silent = true, buffer = bufnr }
        vim.keymap.set('n', '<leader>se', '<Plug>(sqls-execute-query)', opts)
        vim.keymap.set('x', '<leader>se', '<Plug>(sqls-execute-query)', opts)
        vim.keymap.set('n', '<leader>sv', '<Plug>(sqls-execute-query-vertical)', opts)
        vim.keymap.set('x', '<leader>sv', '<Plug>(sqls-execute-query-vertical)', opts)
        vim.keymap.set('n', '<leader>sd', '<cmd>SqlsShowDatabases<CR>', opts)
        vim.keymap.set('n', '<leader>ss', '<cmd>SqlsShowSchemas<CR>', opts)
        vim.keymap.set('n', '<leader>sc', '<cmd>SqlsShowConnections<CR>', opts)
        vim.keymap.set('n', '<leader>st', '<cmd>SqlsShowTables<CR>', opts)
        vim.keymap.set('n', '<leader>sD', '<cmd>SqlsSwitchDatabase<CR>', opts)
        vim.keymap.set('n', '<leader>sC', '<cmd>SqlsSwitchConnection<CR>', opts)
        vim.keymap.set('n', '<leader>sel', '<leader>se_', { remap = true, buffer = bufnr })
        vim.keymap.set('n', '<leader>sep', '<leader>seip', { remap = true, buffer = bufnr })
        vim.keymap.set('n', '<leader>sea', '<leader>seG', { remap = true, buffer = bufnr })

        vim.notify('sqls attached to buffer ' .. bufnr)
    end
}
```

### 10. `ts_go.lua` - TypeScript Go Language Server

**Installation:** `npm i -g @typescript/native-preview`

**Our Configuration:**

**Migration File (`lsp/ts_go.lua`):**

```lua
---@type vim.lsp.Config
return {
    cmd = { 'tsgo', '--lsp', '--stdio' },
    filetypes = { 'javascript', 'javascriptreact', 'typescript', 'typescriptreact' },
    root_markers = { 'tsconfig.json', 'jsconfig.json', 'package.json', '.git' },
    capabilities = capabilities,
}
```

## Implementation Steps

### Phase 1: Setup Infrastructure

1. Create `neovim-config/lsp/` directory
1. Update `lua/lsp.lua` to use new native configs (already uses runtime file discovery)

### Phase 2: Migrate Individual Servers

For each LSP server:

1. Create the configuration file in `lsp/`
1. Copy default settings from lspconfig
1. Apply our customizations with inline root detection
1. Test the server works correctly

### Phase 3: Update Main LSP Setup

1. Ensure capabilities are properly injected into each config
1. Remove dependency on nvim-lspconfig plugin
1. Preserve the FileType autocommand for sqls

### Phase 4: Cleanup

1. Remove or archive `lua/plugins/lspconfig.lua`
1. Remove nvim-lspconfig from lazy.nvim plugins
1. Update Mason dependencies if needed

## Key Differences in Migration

### From lspconfig to Native:

1. **Root Detection**: Simply use `root_markers` array instead of `util.root_pattern()` functions
1. **Capabilities**: Will be injected from main setup rather than using `lsp.protocol.make_client_capabilities()`
1. **Setup Method**: Instead of `lspconfig[server].setup()`, use `vim.lsp.config[server] = config` and `vim.lsp.enable(server)`
1. **No Utility Module**: Each LSP config is self-contained, using native features
1. **On Attach**: Keep special logic (like sqls) in the config's on_attach function

### Special Considerations:

1. **sqls**: Has extensive custom setup with commands and keymaps that needs careful migration
1. **golangci_lint_ls**: Dynamic command generation and version detection
1. **Force Start**: The FileType autocommand for sqls needs to be preserved

## Testing Strategy

1. Test each LSP individually after migration
1. Verify all custom keybindings work
1. Check that root directory detection works correctly
1. Ensure capabilities are properly passed
1. Test special features (sqls commands, gopls hints, etc.)

## Additional Notes

### SQL FileType Autocommand

Add this to your main LSP setup to preserve the force-start behavior for sqls:

```lua
-- Force start sqls for SQL files
vim.api.nvim_create_autocmd("FileType", {
    pattern = { "sql", "mysql" },
    callback = function()
        vim.cmd "LspStart sqls"
    end,
})
```

## Rollback Plan

1. Keep backup of current `lua/plugins/lspconfig.lua`
1. Can temporarily run both systems in parallel
1. Easy revert by re-enabling lspconfig plugin
