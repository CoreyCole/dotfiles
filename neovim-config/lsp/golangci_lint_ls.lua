---@type vim.lsp.Config
return {
    cmd = { "golangci-lint-langserver" },
    filetypes = { "go" },
    root_markers = { "go.mod", ".git" },
    init_options = {
        command = function()
            local defaults = {
                "golangci-lint",
                "run",
                "--fix",
                "--output.json.path=stdout",
                -- Overwrite values possibly set in .golangci.yml
                "--output.text.path=",
                "--output.tab.path=",
                "--output.html.path=",
                "--output.checkstyle.path=",
                "--output.code-climate.path=",
                "--output.junit-xml.path=",
                "--output.teamcity.path=",
                "--output.sarif.path=",
                "--show-stats=false",
                "--build-tags=integration,unit",
            }

            local config = vim.fs.find(
                { ".golangci.yml" },
                { path = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(0), ":p:h"), upward = true }
            )
            if #config > 0 then
                local config_path = vim.fn.fnamemodify(config[1], ":p")
                table.insert(defaults, "--config")
                table.insert(defaults, config_path)
            end

            return defaults
        end,
    },
}