local folder_icon = require("icons").symbol_kinds.Folder

local M = {}

--- Window bar that shows the current file path (in a fancy way).
---@return string
function M.render()
    -- Get the path and expand variables.
    local path = vim.fs.normalize(vim.fn.expand "%:p" --[[@as string]])

    -- No special styling for diff views.
    if vim.startswith(path, "diffview") then
        return path
    end

    -- Replace slashes by arrows.
    local separator = " "

    local prefix, prefix_path = "", ""

    -- If the window gets too narrow, shorten the path and drop the prefix.
    if vim.api.nvim_win_get_width(0) < math.floor(vim.o.columns / 3) then
        path = vim.fn.pathshorten(path)
    else
        -- For some special folders, add a prefix instead of the full path (making
        -- sure to pick the longest prefix). Include sibling feature checkouts
        -- like vamos-*, cn-agents-*, monorepo-*, and monorepo2/monorepo3.
        ---@type table<integer, {name: string, path: string}>
        local special_dirs = {}
        local function add_dir(name, dir, include_variants)
            table.insert(special_dirs, { name = name, path = dir })
            if include_variants then
                local base = vim.fn.fnamemodify(dir, ":t")
                for _, variant in ipairs(vim.fn.glob(dir .. "-*", true, true)) do
                    local suffix = vim.fn.fnamemodify(variant, ":t"):gsub("^" .. vim.pesc(base), "")
                    table.insert(special_dirs, { name = name .. suffix, path = variant })
                end
                for _, variant in ipairs(vim.fn.glob(dir .. "[0-9]*", true, true)) do
                    local suffix = vim.fn.fnamemodify(variant, ":t"):gsub("^" .. vim.pesc(base), "")
                    table.insert(special_dirs, { name = name .. suffix, path = variant })
                end
            end
        end

        add_dir("DOTFILES", vim.env.HOME .. "/dotfiles", false)
        add_dir("CN", vim.env.HOME .. "/cn/chestnut-flake/monorepo", true)
        add_dir("VAMOS", vim.env.HOME .. "/cn/chestnut-flake/vamos", true)
        add_dir("AGENTS", vim.env.HOME .. "/cn/chestnut-flake/cn-agents", true)
        add_dir("DSUI", vim.env.HOME .. "/cn/chestnut-flake/cn-agents/pkg/datastarui", false)
        for _, variant in
            ipairs(vim.fn.glob(vim.env.HOME .. "/cn/chestnut-flake/cn-agents-*/pkg/datastarui", true, true))
        do
            local checkout = variant:match "/cn%-agents([^/]*)/pkg/datastarui$" or ""
            table.insert(special_dirs, { name = "DSUI" .. checkout, path = variant })
        end
        add_dir("HOME", vim.env.HOME, false)

        for _, dir in ipairs(special_dirs) do
            local dir_path = vim.fs.normalize(dir.path)
            if vim.startswith(path, dir_path) and #dir_path > #prefix_path then
                prefix, prefix_path = dir.name, dir_path
            end
        end
        if prefix ~= "" then
            path = path:gsub("^" .. vim.pesc(prefix_path), "")
            prefix = string.format("%s %s%s", folder_icon, prefix, separator)
        end
    end

    -- Remove leading slash.
    path = path:gsub("^/", "")

    return table.concat {
        " ",
        prefix,
        table.concat(vim.iter(vim.split(path, "/")):totable(), separator),
    }
end

vim.api.nvim_create_autocmd("BufWinEnter", {
    group = vim.api.nvim_create_augroup("cc/winbar", { clear = true }),
    desc = "Attach winbar",
    callback = function(args)
        if
            not vim.api.nvim_win_get_config(0).zindex -- Not a floating window
            and vim.bo[args.buf].buftype == "" -- Normal buffer
            and vim.api.nvim_buf_get_name(args.buf) ~= "" -- Has a file name
            and not vim.wo[0].diff -- Not in diff mode
            and not vim.endswith(vim.api.nvim_buf_get_name(args.buf), ".dbout")
            and not vim.endswith(vim.api.nvim_buf_get_name(args.buf), "dbui")
        then
            vim.wo.winbar = "%{%v:lua.require'winbar'.render()%}"
        end
    end,
})

return M
