local status, nvimTree = pcall(require, "nvim-tree")
if (not status) then return end

nvimTree.setup {
    git = {enable = false},
    diagnostics = {enable = true},
    sort_by = "case",
    view = {side = "right", adaptive_size = true, mappings = {list = {{key = "c", action = "cd"}, {key = "k", action = "dir_up"}}}},
    renderer = {group_empty = true},
    filters = {dotfiles = false, custom = {"^.git$"}, exclude = {"om.logs", "om-error.logs", "om-backtrace.logs"}},
    update_focused_file = true,
    update_focused_file = {enable = true, update_cwd = false, ignore_list = {}}
}
