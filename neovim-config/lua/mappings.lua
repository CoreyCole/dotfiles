local map = vim.keymap.set

map("i", "<C-b>", "<ESC>^i", { desc = "move beginning of line" })
map("i", "<C-e>", "<End>", { desc = "move end of line" })
map("i", "<C-h>", "<Left>", { desc = "move left" })
map("i", "<C-l>", "<Right>", { desc = "move right" })
map("i", "<C-j>", "<Down>", { desc = "move down" })
map("i", "<C-k>", "<Up>", { desc = "move up" })

map("n", "<C-h>", "<C-w>h", { desc = "switch window left" })
map("n", "<C-l>", "<C-w>l", { desc = "switch window right" })
map("n", "<C-j>", "<C-w>j", { desc = "switch window down" })
map("n", "<C-k>", "<C-w>k", { desc = "switch window up" })

map("n", "<Esc>", "<cmd>noh<CR>", { desc = "general clear highlights" })

map("n", "<C-s>", "<cmd>w<CR>", { desc = "general save file" })
map("n", "<C-c>", "<cmd>%y+<CR>", { desc = "general copy whole file" })

map("n", "<leader>n", "<cmd>set nu!<CR>", { desc = "toggle line number" })
map("n", "<leader>rn", "<cmd>set rnu!<CR>", { desc = "toggle relative number" })
map("n", "<leader>ch", "<cmd>NvCheatsheet<CR>", { desc = "toggle nvcheatsheet" })

map("n", "<C-n>", "<cmd>NvimTreeToggle<CR>", { desc = "nvimtree toggle window" })
map("n", "<leader>e", "<cmd>NvimTreeFocus<CR>", { desc = "nvimtree focus window" })

-- global lsp mappings
map("n", "<leader>ds", vim.diagnostic.setloclist, { desc = "LSP diagnostic loclist" })

-- Comment
map("n", "<leader>/", "gcc", { desc = "toggle comment", remap = true })
map("v", "<leader>/", "gc", { desc = "toggle comment", remap = true })

-- vertical line at 90 characters
-- let &colorcolumn=join(range(81,999),",")
-- highlight ColorColumn ctermbg=235 guibg=#2c2d27
-- let &colorcolumn="80,".join(range(120,999),",")
map("n", "[l", function()
    vim.opt.colorcolumn = "90," .. table.concat(vim.fn.range(135, 999), ",")
    vim.cmd [[highlight ColorColumn ctermbg=16 guibg=#090909]]
end, { desc = "highlight column at 80 and 135" })
map("n", "]l", function()
    vim.opt.colorcolumn = ""
    vim.cmd [[highlight ColorColumn ctermbg=NONE guibg=NONE]]
end, { desc = "disable columns at 80 and 135" })

map("n", "<leader>s", ":noautocmd w <CR>", { desc = "Save without auto cmd/formatting" })
map("n", ";", ":", { desc = "CMD enter command mode" })
map("n", "<leader>cp", ':let @+ = expand("%:p")', { desc = "Copy full path" })

map("v", "<", "<gv")
map("v", ">", ">gv")

map("n", "<leader>tc", function()
    local ts_utils = require "nvim-treesitter.ts_utils"
    local node = ts_utils.get_node_at_cursor()
    if node then
        print(node:type())
    else
        print "No node found at cursor."
    end
end, { desc = "Get current node type" })
-- map("n", "<leader>x", ":lua require('trouble').toggle()<CR>", { desc = "toggle trouble" })

--
-- lsp
--
-- nmap("gd", vim.lsp.buf.definition, "[G]oto [D]definition")
-- nmap("gd", require("telescope.builtin").lsp_definitions, "[G]oto [D]definition")
-- -- nmap("gr", vim.lsp.buf.references, "[G]oto [R]eferences")
-- nmap("gr", require("telescope.builtin").lsp_references, "[G]oto [R]eferences")
-- -- nmap("gi", vim.lsp.buf.implementation, "[G]oto [I]mplementation")
-- nmap("gi", require("telescope.builtin").lsp_implementations, "[G]oto [I]mplementation")
-- -- nmap("gt", vim.lsp.buf.type_definition, "[G]oto [T]ype Definition")
-- nmap("gt", require("telescope.builtin").lsp_type_definitions, "[G]oto [T]ype Definition")
-- nmap("<leader>ds", require("telescope.builtin").lsp_document_symbols, "[D]ocument [S]symbols")
-- nmap("<leader>ws", require("telescope.builtin").lsp_dynamic_workspace_symbols, "[W]orkspace [S]symbols")
--
map("n", "gq", function()
    -- Get the function name under cursor
    local func_name = vim.fn.expand "<cword>"
    -- Use ripgrep to search for the definition pattern in db/queries
    -- Looking for lines like: -- name: FunctionName
    local rg_cmd = string.format('rg --fixed-strings --line-number "name: %s" db/queries', func_name)
    -- copy to clipboard
    vim.fn.setreg("+", rg_cmd)
    -- Execute ripgrep and get results
    local results = vim.fn.systemlist(rg_cmd)

    if #results == 0 then
        vim.notify("No query definition found for: " .. func_name, vim.log.levels.WARN)
        return
    end

    -- Parse the first result using a more reliable method
    -- ripgrep output format is typically: file:line:content
    local first_result = results[1]

    -- Find the first and second colon positions
    local first_colon_pos = string.find(first_result, ":", 1, true)
    if not first_colon_pos then
        vim.notify("Unexpected ripgrep output format", vim.log.levels.ERROR)
        return
    end

    local second_colon_pos = string.find(first_result, ":", first_colon_pos + 1, true)
    if not second_colon_pos then
        vim.notify("Unexpected ripgrep output format", vim.log.levels.ERROR)
        return
    end

    -- Extract file path and line number
    local file_path = string.sub(first_result, 1, first_colon_pos - 1)
    local line_number = tonumber(string.sub(first_result, first_colon_pos + 1, second_colon_pos - 1))

    if not file_path or not line_number then
        vim.notify(string.format("Failed to parse query definition: %s", results[1]), vim.log.levels.ERROR)
        return
    end

    -- Open the file at the specific line
    vim.cmd(string.format("edit +%d %s", line_number, file_path))
    vim.notify("Found query definition for: " .. func_name)
end, { desc = "Go to Query Definition" })

map("n", "gi", function()
    -- vim.lsp.buf.implementation()
    require("telescope.builtin").lsp_implementations()
end, { desc = "LSP implementation" })
map("n", "gd", function()
    require("telescope.builtin").lsp_definitions()
    vim.cmd "norm! zz" -- center the cursor in the screen
end, { desc = "LSP definition" })
map("n", "gD", function()
    vim.lsp.buf.declaration()
end, { desc = "LSP declaration" })
map("n", "<leader>gr", require("telescope.builtin").lsp_references, { desc = "LSP [G]oto [R]eferences" })
map("n", "<leader>ds", require("telescope.builtin").lsp_document_symbols, { desc = "LSP [D]ocument [S]symbols" })
map("n", "<leader>gt", require("telescope.builtin").lsp_type_definitions, { desc = "LSP [G]oto [T]ype Definition" })
map("n", "<leader>r", ":LspRestart<CR>", { desc = "LSP Restart" })
map("n", "<leader>cc", function()
    require("treesitter-context").enable()
    vim.cmd [[
        hi TreesitterContextBottom gui=underline guisp=Grey
        hi TreesitterContextLineNumberBottom gui=underline guisp=Grey
        ]]
end, { desc = "Enable treesitter context" })
map("n", "[c", function()
    require("treesitter-context").go_to_context(vim.v.count1)
end, { desc = "jump context upward" })

--
-- neogit
--
map("n", "<leader>gn", function()
    require("neogit").open()
end, { desc = "Open Neogit" })
map("n", "<leader>gc", function()
    require("neogit").open { "commit" }
end, { desc = "open commit popup" })
-- open with split
map("n", "<leader>gs", function()
    require("neogit").open { kind = "split" }
end, { desc = "Open Neogit split" })
map("n", "gwq", "<cmd>DiffviewClose<CR>", { desc = "Close DiffView" })
map("n", "<leader>gd", "<cmd>DiffviewOpen<CR>", { desc = "Open DiffView" })
map("n", "<leader>gh", "<cmd>DiffviewFileHistory %<CR>", { desc = "Open DiffView File History for current file" })
map("n", "<leader>gH", "<cmd>DiffviewFileHistory<CR>", { desc = "Open DiffView File History for repository" })
map("n", "<leader>gb", "<cmd>BlameToggle virtual<CR>", { desc = "Toggle Blame" })

-- Helper function to get PR number for current line
local function get_pr_number_for_current_line()
    local filepath = vim.fn.expand "%:p"
    local line_number = vim.fn.line "."

    -- Get the commit that last modified the current line using git blame
    local blame_cmd = string.format('git blame -L %d,%d "%s" | cut -d " " -f 1', line_number, line_number, filepath)
    local commit_hash = vim.fn.trim(vim.fn.system(blame_cmd))

    if not commit_hash or commit_hash == "" or commit_hash == "00000000" then
        return nil, "No commit found for current line."
    end

    -- Get the full commit message
    local commit_msg_cmd = "git log -n 1 --pretty=format:%s " .. commit_hash
    local commit_message = vim.fn.system(commit_msg_cmd)

    -- Try multiple patterns for PR numbers
    local pr_number = nil

    -- Try pattern 1: PR: #123
    pr_number = commit_message:match "PR: #(%d+)"
    if not pr_number then
        -- Try pattern 2: (#123)
        pr_number = commit_message:match "%(#(%d+)%)"
    end
    if not pr_number then
        -- Try pattern 3: pull request #123
        pr_number = commit_message:match "pull request #(%d+)"
    end

    if not pr_number or pr_number == "" then
        return nil, "No PR number found in commit message."
    end

    return pr_number, nil
end

-- Helper function to get repository info
local function get_repo_info()
    local remote_cmd = "git remote get-url origin"
    local remote_url = vim.fn.trim(vim.fn.system(remote_cmd))

    -- Extract repo info from remote URL
    local repo_path = nil
    -- Handle SSH format: git@github.com:user/repo.git
    repo_path = remote_url:match "git@github%.com:(.+)%.git"
    if not repo_path then
        -- Handle HTTPS format: https://github.com/user/repo.git
        repo_path = remote_url:match "https://github%.com/(.+)%.git"
    end
    if not repo_path then
        -- Handle without .git suffix
        repo_path = remote_url:match "github%.com[:/](.+)$"
    end

    return repo_path
end

local function open_recent_pr_for_current_file()
    local pr_number, error_msg = get_pr_number_for_current_line()

    if not pr_number then
        vim.notify(error_msg, vim.log.levels.ERROR)
        return
    end

    local repo_path = get_repo_info()
    if not repo_path then
        vim.notify("Could not parse repository from remote URL", vim.log.levels.ERROR)
        return
    end

    local repo_url = "https://github.com/" .. repo_path .. "/pull/" .. pr_number

    -- Use the same open_url_in_browser function
    local platform = vim.loop.os_uname().sysname
    if platform == "Darwin" then
        os.execute('open "' .. repo_url .. '"')
    elseif platform == "Linux" then
        os.execute('xdg-open "' .. repo_url .. '"')
    end

    vim.notify("Opening PR #" .. pr_number)
end

-- Function to open Graphite PR for current line
local function open_graphite_pr_for_current_line()
    local pr_number, error_msg = get_pr_number_for_current_line()

    if not pr_number then
        vim.notify(error_msg, vim.log.levels.ERROR)
        return
    end

    local repo_path = get_repo_info()
    if not repo_path then
        vim.notify("Could not parse repository from remote URL", vim.log.levels.ERROR)
        return
    end

    local graphite_url = "https://app.graphite.dev/github/pr/" .. repo_path .. "/" .. pr_number

    -- Use the same open_url_in_browser function
    local platform = vim.loop.os_uname().sysname
    if platform == "Darwin" then
        os.execute('open "' .. graphite_url .. '"')
    elseif platform == "Linux" then
        os.execute('xdg-open "' .. graphite_url .. '"')
    end

    vim.notify("Opening Graphite PR #" .. pr_number)
end

-- Register the function as a Neovim command
vim.api.nvim_create_user_command("OpenRecentPR", open_recent_pr_for_current_file, {})
vim.api.nvim_create_user_command("OpenGraphitePR", open_graphite_pr_for_current_line, {})

-- Bind the new command to a key
vim.keymap.set("n", "<leader>gpr", ":OpenRecentPR<CR>", { desc = "Open the most recent PR for the current file" })
vim.keymap.set("n", "<leader>pr", ":OpenGraphitePR<CR>", { desc = "Open the Graphite PR for the current line" })

--
-- rust
--
local bufnr = vim.api.nvim_get_current_buf()
map("n", "<leader>a", function()
    vim.cmd.RustLsp "codeAction" -- supports rust-analyzer's grouping
    -- or vim.lsp.buf.codeAction() if you don't want grouping.
end, { silent = true, buffer = bufnr })
map("n", "<leader>rcu", function()
    require("crates").update_all_crates()
end, { desc = "upgrade all crates" })

--
-- package.json
--
map("n", "<leader>ns", function()
    require("package-info").show()
end, { desc = "show package.json virtual text" })

map("n", "<leader>nc", function()
    require("package-info").hide()
end, { desc = "hide package.json virtual text" })

map("n", "<leader>nt", function()
    require("package-info").toggle()
end, { desc = "toggle package.json virtual text" })

map("n", "<leader>np", function()
    require("package-info").change_version()
end, { desc = "change package.json version on current line" })

map("n", "<leader>nu", function()
    require("package-info").update()
end, { desc = "update package.json on current line" })

map("n", "<leader>ni", function()
    require("package-info").install()
end, { desc = "install package.json on current line" })

-- dap
map("n", "<leader>dus", function()
    local widgets = require "dap.ui.widgets"
    local sidebar = widgets.sidebar(widgets.scopes)
    sidebar.open()
end, { desc = "Open debugging sidebar" })

map("n", "<leader>db", "<cmd> DapToggleBreakpoint <CR>", { desc = "Add breakpoint at line" })

-- go
map("n", "<leader>dgt", function()
    require("dap-go").test()
end, { desc = "Debug go test" })
map("n", "<leader>y", function()
    require("neotest").run.run { suite = false, strategy = "dap" }
end, { desc = "Debug go test neotest" })
map("n", "<leader>ca", function()
    require("tiny-code-action").code_action()
end, { desc = "code action" })

-- python
map("n", "<leader>dpr", function()
    require("dap-python").test_method()
end, { desc = "Debug python test method" })

-- copilot
vim.g.copilot_assume_mapped = true
vim.g.copilot_tab_fallback = ""
-- map("i", "<C-l>", function()
--   vim.fn.feedkeys(vim.fn["copilot#Accept"](), "")
-- end, { desc = "Copilot Accept" })
local function accept_line(suggestion_function)
    local line = vim.fn.line "."
    local line_count = vim.fn.line "$"

    suggestion_function()

    local added_lines = vim.fn.line "$" - line_count

    if added_lines > 1 then
        vim.api.nvim_buf_set_lines(0, line + 1, line + added_lines, false, {})
        local last_col = #vim.api.nvim_buf_get_lines(0, line, line + 1, true)[1] or 0
        vim.api.nvim_win_set_cursor(0, { line + 1, last_col })
    end
end

map("i", "<C-l>", function()
    -- supermaven accept
    require("supermaven-nvim.completion_preview").on_accept_suggestion()
end, { desc = "Supermaven Accept" })
map("i", "<C-;>", function()
    vim.fn.feedkeys(vim.fn["copilot#Accept#Line"](), "")
end, { desc = "Copilot Accept Line" })

map("i", "<C-k>", function()
    vim.fn.feedkeys(vim.fn["copilot#Previous"](), "")
end, { desc = "Copilot Previous" })

map("i", "<C-j>", function()
    vim.fn.feedkeys(vim.fn["copilot#Next"](), "")
end, { desc = "Copilot Next" })

--
-- nvchad tabufline
--
map("n", "<leader>wq", function()
    require("nvchad.tabufline").close_buffer()
end, { desc = "close tab" })

-- closes tab + other buffers except the current one
local function closeOtherBufs(c_buf)
    for _, buf in ipairs(vim.t.bufs) do
        if buf ~= c_buf then
            require("nvchad.tabufline").close_buffer(buf)
        end
    end
end
map("n", "<leader>wo", function()
    closeOtherBufs(vim.api.nvim_get_current_buf())
end, { desc = "close other tabs" })

--
-- paths
--
map("n", "<leader>cpp", function()
    local path = vim.fn.expand "%:p"
    vim.fn.setreg("+", path)
    vim.notify('Copied "' .. path .. '" to the clipboard!')
end, { desc = "Copy full path" })
map("n", "<leader>cpr", function()
    local path = vim.fn.expand "%:."
    path = path:gsub("([%(%)%[%]])", "\\%1")
    vim.fn.setreg("+", path)
    vim.notify('Copied "' .. path .. '" to the clipboard!')
end, { desc = "Copy relative path" })
map("n", "<leader>cpf", ':let @+ = expand("%:t")', { desc = "Copy filename" })

--
-- markdown
--
function InsertMarkdownURL()
    local url = vim.fn.getreg "+"
    if url == "" then
        return
    end
    local cmd = "curl -L " .. vim.fn.shellescape(url) .. " 2>/dev/null"
    local handle = io.popen(cmd)
    if not handle then
        return
    end
    local html = handle:read "*a"
    handle:close()
    local title = ""
    local pattern = "<title>(.-)</title>"
    local m = string.match(html, pattern)
    if m then
        title = m
    end
    if title ~= "" then
        local markdownLink = "[" .. title .. "](" .. url .. ")"
        vim.api.nvim_command("call append(line('.'), '" .. markdownLink .. "')")
    else
        print "Title not found for link"
    end
end
map("n", "<leader>mdp", ":lua InsertMarkdownURL()<CR>", { desc = "markdown paste url" })

--
-- templ
--
local templ_format = function()
    local bufnr = vim.api.nvim_get_current_buf()
    local filename = vim.api.nvim_buf_get_name(bufnr)
    local cmd = "templ fmt " .. vim.fn.shellescape(filename)

    vim.fn.jobstart(cmd, {
        on_exit = function()
            -- Reload the buffer only if it's still the current buffer
            if vim.api.nvim_get_current_buf() == bufnr then
                vim.cmd "e!"
            end
        end,
    })
end
map("n", "<leader>lf", function()
    templ_format()
end, { desc = "format templ html" })

--
-- rest.nvim
--
map("n", "<leader>rr", "<cmd>Rest run<cr>", { desc = "Run request under the cursor" })
map("n", "<leader>rl", "<cmd>Rest run last<cr>", { desc = "Re-run latest request" })

--
-- csv
--
map("n", "<leader>,", function()
    -- move cursor to the first comma
    vim.cmd "normal! f,"
    vim.cmd "RainbowDelimSimple"
end, { desc = "RainbowDelimSimple" })
map("n", "<leader>l", function()
    require("csvview").toggle()
    -- move cursor to the first comma
    vim.cmd "normal! f,"
    vim.cmd "RainbowDelimSimple"
end, { desc = "RainbowAlign" })

--
-- diagnostics
--
map("n", "<leader>dt", function()
    local current = vim.diagnostic.config().virtual_text
    vim.diagnostic.config {
        virtual_text = not current,
        -- Keep other diagnostic displays enabled
        signs = true,
        underline = true,
        update_in_insert = false,
        severity_sort = true,
    }
end, { desc = "Toggle inline diagnostic text" })

local function get_pr_link_for_current_line()
    -- Get the current file path
    local file_path = vim.fn.expand "%:p"

    -- Get the current line number
    local line_number = vim.fn.line "."

    -- Get the commit hash that last modified the current line using git blame
    local blame_cmd = string.format('git blame -L %d,%d %s | cut -d " " -f 1', line_number, line_number, file_path)
    local commit_hash = vim.fn.trim(vim.fn.system(blame_cmd))

    -- Get the commit message for this hash
    local commit_msg_cmd = string.format("git show -s --format=%%s %s", commit_hash)
    local commit_message = vim.fn.trim(vim.fn.system(commit_msg_cmd))

    -- Often PR squash commit messages start with the PR title followed by "(#1234)"
    -- Try to extract PR number from the commit message if it follows this pattern
    local pr_number = commit_message:match "%(#(%d+)%)"

    if not pr_number then
        vim.notify("No PR number found in commit message", vim.log.levels.WARN)
    end
    -- If we found a PR number directly in the commit message
    local repo_url = "github.com/premiumlabs/monorepo"
    local pr_url = string.format("https://%s/pull/%s", repo_url, pr_number)

    return pr_url
end

-- Function to open URL in browser based on OS
local function open_url_in_browser(url)
    local platform = vim.loop.os_uname().sysname

    if platform == "Darwin" then
        -- macOS
        os.execute('open "' .. url .. '"')
    elseif platform == "Linux" then
        -- Linux
        os.execute('xdg-open "' .. url .. '"')
    elseif platform == "Windows_NT" then
        -- Windows
        os.execute('start "" "' .. url .. '"')
    else
        print("Unsupported platform: " .. platform)
        return false
    end

    return true
end

-- Function to show the PR link or error message
local function open_pr_for_current_line()
    local pr_link, error_msg = get_pr_link_for_current_line()

    if not pr_link then
        vim.notify("Failed to find PR link", vim.log.levels.ERROR)
    end
    vim.notify(pr_link, vim.log.levels.INFO)

    -- Open in browser
    if not open_url_in_browser(pr_link) then
        vim.notify("Failed to open PR in browser", vim.log.levels.ERROR)
    end
end
map("n", "<leader>gp", open_pr_for_current_line, { desc = "Open GitHub PR for current line" })

-- Function to open the current file in Cursor at the current line
local function open_in_cursor()
    local file_path = vim.fn.expand "%:p"
    local line_number = vim.fn.line "."
    local workspace_dir = "/Users/coreycole/cn/chestnut-flake/monorepo"

    -- First: Open the folder via URL scheme
    local folder_url = "cursor://file/" .. workspace_dir .. "?windowId=_blank"

    vim.notify("Opening folder: " .. folder_url, vim.log.levels.INFO)

    -- Open the folder first
    if open_url_in_browser(folder_url) then
        -- Now use CLI to open the specific file at the right line
        local cmd = string.format('cursor --goto "%s:%s"', file_path, line_number)

        vim.notify("Running command: " .. cmd, vim.log.levels.INFO)

        -- Execute the command
        local result = vim.fn.system(cmd)

        if vim.v.shell_error == 0 then
            vim.notify("Opened file in Cursor", vim.log.levels.INFO)
        else
            vim.notify("Failed to open file (cmd: " .. cmd .. ")", vim.log.levels.ERROR)
        end
    else
        vim.notify("Failed to open folder in Cursor", vim.log.levels.ERROR)
    end
end
map("n", "<leader>cu", open_in_cursor, { desc = "Open in Cursor at current line" })

-- Function to open current line on develop branch in GitHub
local function open_line_on_develop()
    local repo_path = get_repo_info()
    if not repo_path then
        vim.notify("Could not parse repository from remote URL", vim.log.levels.ERROR)
        return
    end

    -- Get current file path relative to git root
    local file_path = vim.fn.expand "%:p"
    local git_root = vim.fn.system("git rev-parse --show-toplevel"):gsub("\n", "")
    local relative_path = file_path:sub(#git_root + 2) -- +2 to skip the trailing slash

    -- Get current line number
    local line_number = vim.fn.line "."

    -- Construct GitHub URL for develop branch
    local github_url = string.format("https://github.com/%s/blob/develop/%s#L%d", repo_path, relative_path, line_number)

    -- Open in browser
    if not open_url_in_browser(github_url) then
        vim.notify("Failed to open GitHub URL", vim.log.levels.ERROR)
    else
        vim.notify("Opening line " .. line_number .. " on develop branch")
    end
end

map("n", "<leader>gl", open_line_on_develop, { desc = "Open current line on develop branch in GitHub" })

-- Convert tabs to spaces and fix line endings
map("n", "<leader>tt", function()
    -- Set expandtab to ensure spaces are used
    vim.opt.expandtab = true
    -- Convert all tabs to spaces using current tabstop setting
    vim.cmd "retab"
    -- Convert CRLF to LF immediately in the buffer
    vim.cmd [[%s/\r$//e]]
    vim.notify "Converted tabs to spaces and fixed line endings"
end, { desc = "Convert tabs to spaces and fix line endings" })

map("n", "<leader>fr", "<cmd>GrugFar<cr>", { desc = "GrugFar" })
map("n", "<leader>fw", function()
    local word = vim.fn.expand "<cword>"
    vim.fn.setreg("+", word)
    require("grug-far").open {
        prefills = { search = word },
        instance_name = "main",
    }
end, { desc = "GrugFar word under cursor" })
map("n", "<leader>fW", function()
    local word = vim.fn.expand "<cWORD>"
    vim.fn.setreg("+", word)
    require("grug-far").open {
        prefills = { search = word },
        instance_name = "main",
    }
end, { desc = "GrugFar WORD under cursor" })

-- Remap j/k to include scrolling
map("n", "j", "j<C-e>", { desc = "Move down and scroll down" })
map("n", "k", "k<C-y>", { desc = "Move up and scroll up" })
