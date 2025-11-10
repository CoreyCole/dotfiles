---@type vim.lsp.Config
local function golangci_lint_args()
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
end

return {
    cmd = { "golangci-lint-langserver" }, -- Debug flag can be added dynamically if needed
    filetypes = { "go", "gomod" },
    root_markers = {
        ".golangci.yml",
        ".golangci.yaml",
        ".golangci.toml",
        ".golangci.json",
        "go.work",
        "go.mod",
        ".git",
    },
    init_options = {
        command = golangci_lint_args(),
    },
    -- Version detection can be done in before_init if needed
    before_init = function(params, config)
        -- Detect golangci-lint version and adjust command if needed
        local version_output = vim.fn.system "golangci-lint version --format short"
        local major = version_output:match "(%d+)%."
        if major and tonumber(major) < 2 then
            -- Adjust for v1 compatibility
            local cmd = config.init_options.command
            for i, arg in ipairs(cmd) do
                if arg:find "^%-%-output%." then
                    cmd[i] = nil
                end
            end
        end
    end,
    capabilities = capabilities,
}

