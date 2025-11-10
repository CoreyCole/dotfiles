local diagnostic_icons = require("icons").diagnostics
local methods = vim.lsp.protocol.Methods

local M = {}

-- Helper function to align markdown table columns
local function align_markdown_table(lines)
    local result = {}
    local in_table = false
    local table_rows = {}
    local col_widths = {}
    local is_separator = {}

    -- First pass: collect table rows and calculate column widths
    for _, line in ipairs(lines) do
        if line:match "^%s*|" and line:match "|%s*$" then
            in_table = true
            local cells = {}

            -- Split by | and extract cells
            local raw_cells = vim.split(line, "|", { plain = true })

            -- Remove first and last empty elements (from leading/trailing pipes)
            for i = 2, #raw_cells - 1 do
                local cell = vim.trim(raw_cells[i])
                -- Clean HTML entities
                cell = cell:gsub("&nbsp;", " ")
                table.insert(cells, cell)
            end

            -- Check if this is a separator row (contains only -, :, and spaces)
            local is_sep = true
            for _, cell in ipairs(cells) do
                if not cell:match("^[%s%-:]*$") then
                    is_sep = false
                    break
                end
            end

            -- Calculate column widths (don't count separator rows)
            if not is_sep then
                for i, cell in ipairs(cells) do
                    -- Calculate visible width (backticks are concealed in markdown)
                    local visible_width = #cell

                    -- Check if cell is wrapped in backticks (inline code)
                    if cell:match("^`.*`$") then
                        -- Subtract 2 for the concealed backticks
                        visible_width = visible_width - 2
                    end

                    col_widths[i] = math.max(col_widths[i] or 0, visible_width)
                end
            end

            table.insert(table_rows, { cells = cells, is_separator = is_sep })
        else
            -- Process accumulated table if we're leaving a table
            if in_table and #table_rows > 0 then
                -- Format each row with aligned columns
                for _, row in ipairs(table_rows) do
                    local formatted = "|"
                    for i, cell in ipairs(row.cells) do
                        local width = col_widths[i] or 0

                        if row.is_separator then
                            -- For separator rows, add 2 to width to account for padding spaces
                            local sep_width = width + 2
                            if cell == "" then
                                -- Empty separator cell
                                formatted = formatted .. string.rep("-", sep_width) .. "|"
                            elseif cell:match("^:%-+:$") then
                                -- Center aligned
                                formatted = formatted .. ":" .. string.rep("-", sep_width - 2) .. ":|"
                            elseif cell:match("^:%-+$") then
                                -- Left aligned
                                formatted = formatted .. ":" .. string.rep("-", sep_width - 1) .. "|"
                            elseif cell:match("^%-+:$") then
                                -- Right aligned
                                formatted = formatted .. string.rep("-", sep_width - 1) .. ":|"
                            else
                                -- Default (no alignment markers)
                                formatted = formatted .. string.rep("-", sep_width) .. "|"
                            end
                        else
                            -- Regular cells - pad with spaces
                            -- Account for concealed backticks when calculating padding
                            local visible_width = #cell
                            if cell:match("^`.*`$") then
                                visible_width = visible_width - 2
                            end
                            formatted = formatted .. " " .. cell .. string.rep(" ", width - visible_width) .. " |"
                        end
                    end
                    table.insert(result, formatted)
                end

                -- Reset for next table
                table_rows = {}
                col_widths = {}
                in_table = false
            end

            -- Add non-table line
            table.insert(result, line)
        end
    end

    -- Process any remaining table at end of content
    if in_table and #table_rows > 0 then
        for _, row in ipairs(table_rows) do
            local formatted = "|"
            for i, cell in ipairs(row.cells) do
                local width = col_widths[i] or 0

                if row.is_separator then
                    -- For separator rows, add 2 to width to account for padding spaces
                    local sep_width = width + 2
                    if cell == "" then
                        -- Empty separator cell
                        formatted = formatted .. string.rep("-", sep_width) .. "|"
                    elseif cell:match("^:%-+:$") then
                        -- Center aligned
                        formatted = formatted .. ":" .. string.rep("-", sep_width - 2) .. ":|"
                    elseif cell:match("^:%-+$") then
                        -- Left aligned
                        formatted = formatted .. ":" .. string.rep("-", sep_width - 1) .. "|"
                    elseif cell:match("^%-+:$") then
                        -- Right aligned
                        formatted = formatted .. string.rep("-", sep_width - 1) .. ":|"
                    else
                        -- Default (no alignment markers)
                        formatted = formatted .. string.rep("-", sep_width) .. "|"
                    end
                else
                    -- Regular cells - pad with spaces
                    -- Account for concealed backticks when calculating padding
                    local visible_width = #cell
                    if cell:match("^`.*`$") then
                        visible_width = visible_width - 2
                    end
                    formatted = formatted .. " " .. cell .. string.rep(" ", width - visible_width) .. " |"
                end
            end
            table.insert(result, formatted)
        end
    end

    return result
end

--- Sets up LSP keymaps and autocommands for the given buffer.
---@param client vim.lsp.Client
---@param bufnr integer
local function on_attach(client, bufnr)
    ---@param lhs string
    ---@param rhs string|function
    ---@param desc string
    ---@param mode? string|string[]
    local function keymap(lhs, rhs, desc, mode)
        mode = mode or "n"
        vim.keymap.set(mode, lhs, rhs, { buffer = bufnr, desc = desc })
    end

    require("lightbulb").attach_lightbulb(bufnr, client.id)

    -- Don't check for the capability here to allow dynamic registration of the request.
    vim.lsp.document_color.enable(true, bufnr)

    if client:supports_method(methods.textDocument_documentColor) then
        keymap("grc", function()
            vim.lsp.document_color.color_presentation()
        end, "vim.lsp.document_color.color_presentation()", { "n", "x" })
    end

    keymap("<leader>ds", vim.diagnostic.setloclist, "LSP diagnostic loclist")

    keymap("gra", function()
        require("tiny-code-action").code_action {}
    end, "vim.lsp.buf.code_action()", { "n", "x" })

    keymap("<leader>gr", "<cmd>FzfLua lsp_references<cr>", "vim.lsp.buf.references()")

    keymap("gy", "<cmd>FzfLua lsp_typedefs<cr>", "Go to type definition")

    keymap("<leader>fs", "<cmd>FzfLua lsp_document_symbols<cr>", "Document symbols")

    keymap("[d", function()
        vim.diagnostic.jump { count = -1 }
    end, "Previous diagnostic")
    keymap("]d", function()
        vim.diagnostic.jump { count = 1 }
    end, "Next diagnostic")
    keymap("[e", function()
        vim.diagnostic.jump { count = -1, severity = vim.diagnostic.severity.ERROR }
    end, "Previous error")
    keymap("]e", function()
        vim.diagnostic.jump { count = 1, severity = vim.diagnostic.severity.ERROR }
    end, "Next error")

    if client:supports_method(methods.textDocument_definition) then
        keymap("gd", function()
            require("fzf-lua").lsp_definitions { jump1 = true }
            vim.cmd "norm! zz" -- center the cursor in the screen
        end, "Go to definition")
        keymap("gD", function()
            require("fzf-lua").lsp_definitions { jump1 = false }
        end, "Peek definition")
    end

    if client:supports_method(methods.textDocument_signatureHelp) then
        keymap("<C-k>", function()
            -- Close the completion menu first (if open).
            if require("blink.cmp.completion.windows.menu").win:is_open() then
                require("blink.cmp").hide()
            end

            vim.lsp.buf.signature_help()
        end, "Signature help", "i")
    end

    if client:supports_method(methods.textDocument_documentHighlight) then
        local under_cursor_highlights_group = vim.api.nvim_create_augroup("cc/cursor_highlights", { clear = false })
        vim.api.nvim_create_autocmd({ "CursorHold", "InsertLeave" }, {
            group = under_cursor_highlights_group,
            desc = "Highlight references under the cursor",
            buffer = bufnr,
            callback = vim.lsp.buf.document_highlight,
        })
        vim.api.nvim_create_autocmd({ "CursorMoved", "InsertEnter", "BufLeave" }, {
            group = under_cursor_highlights_group,
            desc = "Clear highlight references",
            buffer = bufnr,
            callback = vim.lsp.buf.clear_references,
        })
    end

    if client:supports_method(methods.textDocument_inlayHint) then
        local inlay_hints_group = vim.api.nvim_create_augroup("cc/toggle_inlay_hints", { clear = false })

        if vim.g.inlay_hints then
            -- Initial inlay hint display.
            -- Idk why but without the delay inlay hints aren't displayed at the very start.
            vim.defer_fn(function()
                local mode = vim.api.nvim_get_mode().mode
                vim.lsp.inlay_hint.enable(mode == "n" or mode == "v", { bufnr = bufnr })
            end, 500)
        end

        vim.api.nvim_create_autocmd("InsertEnter", {
            group = inlay_hints_group,
            desc = "Enable inlay hints",
            buffer = bufnr,
            callback = function()
                if vim.g.inlay_hints then
                    vim.lsp.inlay_hint.enable(false, { bufnr = bufnr })
                end
            end,
        })

        vim.api.nvim_create_autocmd("InsertLeave", {
            group = inlay_hints_group,
            desc = "Disable inlay hints",
            buffer = bufnr,
            callback = function()
                if vim.g.inlay_hints then
                    vim.lsp.inlay_hint.enable(true, { bufnr = bufnr })
                end
            end,
        })
    end

    -- Add "Fix all" command for ESLint.
    if client.name == "eslint" then
        vim.keymap.set("n", "<leader>ce", function()
            if not client then
                return
            end

            client:request(vim.lsp.protocol.Methods.workspace_executeCommand, {
                command = "eslint.applyAllFixes",
                arguments = {
                    {
                        uri = vim.uri_from_bufnr(bufnr),
                        version = vim.lsp.util.buf_versions[bufnr],
                    },
                },
            }, nil, bufnr)
        end, { desc = "Fix all ESLint errors", buffer = bufnr })
    end
end

-- Define the diagnostic signs.
for severity, icon in pairs(diagnostic_icons) do
    local hl = "DiagnosticSign" .. severity:sub(1, 1) .. severity:sub(2):lower()
    vim.fn.sign_define(hl, { text = icon, texthl = hl })
end

-- Diagnostic configuration.
vim.diagnostic.config {
    virtual_text = {
        prefix = "",
        spacing = 2,
        format = function(diagnostic)
            -- Use shorter, nicer names for some sources:
            local special_sources = {
                ["Lua Diagnostics."] = "lua",
                ["Lua Syntax Check."] = "lua",
            }

            local message = diagnostic_icons[vim.diagnostic.severity[diagnostic.severity]]
            if diagnostic.source then
                message = string.format("%s %s", message, special_sources[diagnostic.source] or diagnostic.source)
            end
            if diagnostic.code then
                message = string.format("%s[%s]", message, diagnostic.code)
            end

            return message .. " "
        end,
    },
    float = {
        source = "if_many",
        -- Show severity icons as prefixes.
        prefix = function(diag)
            local level = vim.diagnostic.severity[diag.severity]
            local prefix = string.format(" %s ", diagnostic_icons[level])
            return prefix, "Diagnostic" .. level:gsub("^%l", string.upper)
        end,
    },
    -- Disable signs in the gutter.
    signs = false,
}

-- Override the virtual text diagnostic handler so that the most severe diagnostic is shown first.
local show_handler = vim.diagnostic.handlers.virtual_text.show
assert(show_handler)
local hide_handler = vim.diagnostic.handlers.virtual_text.hide
vim.diagnostic.handlers.virtual_text = {
    show = function(ns, bufnr, diagnostics, opts)
        table.sort(diagnostics, function(diag1, diag2)
            return diag1.severity > diag2.severity
        end)
        return show_handler(ns, bufnr, diagnostics, opts)
    end,
    hide = hide_handler,
}

-- Set up an autocmd to format tables in floating windows after they're created
vim.api.nvim_create_autocmd("BufWinEnter", {
    callback = function(args)
        local win = vim.api.nvim_get_current_win()
        local config = vim.api.nvim_win_get_config(win)

        -- Check if this is a floating window (hover, signature help, etc.)
        if config.relative ~= "" then
            -- Small delay to let content render
            vim.defer_fn(function()
                -- Check if window is still valid
                if vim.api.nvim_win_is_valid(win) then
                    local buf = vim.api.nvim_win_get_buf(win)
                    local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)

                    -- Check if there's a markdown table
                    local has_table = false
                    for _, line in ipairs(lines) do
                        if line:match "^%s*|.*|.*|" then
                            has_table = true
                            break
                        end
                    end

                    if has_table then
                        local formatted = align_markdown_table(lines)

                        -- Update the buffer
                        vim.api.nvim_buf_set_option(buf, "modifiable", true)
                        vim.api.nvim_buf_set_lines(buf, 0, -1, false, formatted)
                        vim.api.nvim_buf_set_option(buf, "modifiable", false)
                    end
                end
            end, 10)
        end
    end,
})

local hover = vim.lsp.buf.hover
---@diagnostic disable-next-line: duplicate-set-field
vim.lsp.buf.hover = function()
    return hover {
        max_height = math.floor(vim.o.lines * 0.5),
        max_width = math.floor(vim.o.columns * 5.0),
    }
end

local signature_help = vim.lsp.buf.signature_help
---@diagnostic disable-next-line: duplicate-set-field
vim.lsp.buf.signature_help = function()
    return signature_help {
        max_height = math.floor(vim.o.lines * 0.5),
        max_width = math.floor(vim.o.columns * 0.4),
    }
end

-- Update mappings when registering dynamic capabilities.
local register_capability = vim.lsp.handlers[methods.client_registerCapability]
vim.lsp.handlers[methods.client_registerCapability] = function(err, res, ctx)
    local client = vim.lsp.get_client_by_id(ctx.client_id)
    if not client then
        return
    end

    on_attach(client, vim.api.nvim_get_current_buf())

    return register_capability(err, res, ctx)
end

vim.api.nvim_create_user_command("LspInfo", function()
    vim.cmd "checkhealth vim.lsp"
end, {})

-- Debug command to check hover handler
vim.api.nvim_create_user_command("LspDebugHover", function()
    local handler = vim.lsp.handlers["textDocument/hover"]
    vim.notify("Current hover handler: " .. tostring(handler), vim.log.levels.INFO)

    -- Test the formatting function
    local test_lines = {
        "# Table Test",
        "",
        "| Name&nbsp;&nbsp; | Type&nbsp;&nbsp; | Primary&nbsp;key&nbsp;&nbsp; | Default&nbsp;&nbsp; | Extra&nbsp;&nbsp; |",
        "| :--------------- | :--------------- | :---------------------- | :------------------ | :---------------- |",
        "| `id` | `uuid` | `YES` | `uuid_generate_v7()` |  |",
        "| `created_at` | `timestamp with time zone` | `NO` | `now()` |  |",
    }

    local formatted = align_markdown_table(test_lines)
    vim.notify("Test formatting result:", vim.log.levels.INFO)
    for _, line in ipairs(formatted) do
        vim.notify(line, vim.log.levels.INFO)
    end
end, {})

vim.api.nvim_create_autocmd("LspAttach", {
    desc = "Configure LSP keymaps",
    callback = function(args)
        local client = vim.lsp.get_client_by_id(args.data.client_id)

        -- I don't think this can happen but it's a wild world out there.
        if not client then
            return
        end

        on_attach(client, args.buf)
    end,
})

-- Set up LSP servers.
vim.api.nvim_create_autocmd({ "BufReadPre", "BufNewFile" }, {
    once = true,
    callback = function()
        local server_configs = vim.iter(vim.api.nvim_get_runtime_file("lsp/*.lua", true))
            :map(function(file)
                return vim.fn.fnamemodify(file, ":t:r")
            end)
            :totable()
        vim.lsp.enable(server_configs)
    end,
})

return M
