-- Helper function to align markdown table columns in SQL hover responses
local function align_markdown_table(lines)
    local result = {}
    local table_rows = {}
    local col_widths = {}

    -- Helper: Calculate visible width accounting for concealed backticks
    local function get_visible_width(cell)
        local width = #cell
        if cell:match "^`.*`$" then
            return width - 2 -- Backticks are concealed in markdown
        end
        return width
    end

    -- Helper: Format accumulated table rows
    local function format_table_rows()
        for _, row in ipairs(table_rows) do
            local formatted = "|"
            for i, cell in ipairs(row.cells) do
                local width = col_widths[i] or 0

                if row.is_separator then
                    -- Simple separator - no need for alignment marker complexity
                    formatted = formatted .. string.rep("-", width + 2) .. "|"
                else
                    -- Regular cells with padding
                    local padding = width - get_visible_width(cell)
                    formatted = formatted .. " " .. cell .. string.rep(" ", padding) .. " |"
                end
            end
            table.insert(result, formatted)
        end
    end

    -- Process lines
    for _, line in ipairs(lines) do
        if line:match "^%s*|" and line:match "|%s*$" then
            -- This is a table row
            local cells = {}
            local raw_cells = vim.split(line, "|", { plain = true })

            -- Extract cells (skip first and last empty elements from pipes)
            for i = 2, #raw_cells - 1 do
                local cell = vim.trim(raw_cells[i]):gsub("&nbsp;", " ")
                table.insert(cells, cell)
            end

            -- Check if separator row
            local is_sep = cells[1] and cells[1]:match "^[%s%-:]*$" ~= nil

            -- Calculate column widths (exclude separator rows)
            if not is_sep then
                for i, cell in ipairs(cells) do
                    col_widths[i] = math.max(col_widths[i] or 0, get_visible_width(cell))
                end
            end

            table.insert(table_rows, { cells = cells, is_separator = is_sep })
        else
            -- Non-table line - format any accumulated table first
            if #table_rows > 0 then
                format_table_rows()
                table_rows = {}
                col_widths = {}
            end
            table.insert(result, line)
        end
    end

    -- Format any remaining table at end
    if #table_rows > 0 then
        format_table_rows()
    end

    return result
end

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
                        vim.api.nvim_set_option_value("modifiable", true, { buf = buf })
                        vim.api.nvim_buf_set_lines(buf, 0, -1, false, formatted)
                        vim.api.nvim_set_option_value("modifiable", false, { buf = buf })
                    end
                end
            end, 10)
        end
    end,
})

