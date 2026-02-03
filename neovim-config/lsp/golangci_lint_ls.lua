---@type vim.lsp.Config
local function golangci_lint_args()
    local defaults = {
        "golangci-lint",
        "run",
        -- "--fix", -- disabled: causes auto-formatting on file open
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
    before_init = function(_, config)
        -- Add support for golangci-lint V1 (in V2 `--out-format=json` was replaced by
        -- `--output.json.path=stdout`).
        local v1, v2 = false, false
        -- PERF: `golangci-lint version` is very slow (about 0.1 sec) so let's find
        -- version using `go version -m $(which golangci-lint) | grep '^\smod'`.
        if vim.fn.executable "go" == 1 then
            local exe = vim.fn.exepath "golangci-lint"
            local version = vim.system({ "go", "version", "-m", exe }):wait()
            v1 = string.match(version.stdout, "\tmod\tgithub.com/golangci/golangci%-lint\t")
            v2 = string.match(version.stdout, "\tmod\tgithub.com/golangci/golangci%-lint/v2\t")
        end
        if not v1 and not v2 then
            local version = vim.system({ "golangci-lint", "version" }):wait()
            v1 = string.match(version.stdout, "version v?1%.")
        end
        if v1 then
            config.init_options.command = { "golangci-lint", "run", "--out-format", "json" }
        end
    end,
}
