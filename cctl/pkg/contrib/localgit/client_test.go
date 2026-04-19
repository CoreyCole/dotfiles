package localgit

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/coreycole/cctl/pkg/contrib/config"
)

func TestParsePRNumber(t *testing.T) {
	tests := []struct {
		message string
		want    int
	}{
		{"Merge pull request #123 from org/feature", 123},
		{"add export sorting fix (#456)", 456},
		{"docs: cleanup #789", 789},
		{"plain commit", 0},
	}
	for _, tt := range tests {
		if got := ParsePRNumber(tt.message); got != tt.want {
			t.Fatalf("ParsePRNumber(%q) = %d, want %d", tt.message, got, tt.want)
		}
	}
}

func TestNormalizeGitHubRemote(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{"git@github.com:coreycole/cctl.git", "https://github.com/coreycole/cctl"},
		{"https://github.com/coreycole/cctl.git", "https://github.com/coreycole/cctl"},
		{"https://github.com/coreycole/cctl", "https://github.com/coreycole/cctl"},
		{"ssh://git@example.com/internal/repo", ""},
	}
	for _, tt := range tests {
		if got := NormalizeGitHubRemote(tt.raw); got != tt.want {
			t.Fatalf("NormalizeGitHubRemote(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}

func TestListBranchCommits(t *testing.T) {
	repoDir := t.TempDir()
	runGit(t, repoDir, nil, "init", "-b", "main")
	runGit(t, repoDir, nil, "config", "user.name", "Alice Example")
	runGit(t, repoDir, nil, "config", "user.email", "alice@example.com")
	runGit(t, repoDir, nil, "remote", "add", "origin", "git@github.com:coreycole/cctl.git")

	commitFile(t, repoDir, "README.md", "hello\n", "2026-01-02T12:00:00Z", "initial commit")
	commitFile(t, repoDir, "main.go", "package main\n", "2026-01-03T12:00:00Z", "add export path (#42)")

	cfg := config.ExportConfig{
		RepoDir:   repoDir,
		Branch:    "main",
		StartDate: "2026-01-01",
		EndDate:   "2026-01-31",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}

	records, err := New().ListBranchCommits(context.Background(), cfg)
	if err != nil {
		t.Fatalf("ListBranchCommits: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("got %d records, want 2", len(records))
	}

	second := records[1]
	if second.RepoLabel != "coreycole/cctl" {
		t.Fatalf("RepoLabel = %q", second.RepoLabel)
	}
	if second.RepoWebURL != "https://github.com/coreycole/cctl" {
		t.Fatalf("RepoWebURL = %q", second.RepoWebURL)
	}
	if second.PRNumber != 42 {
		t.Fatalf("PRNumber = %d, want 42", second.PRNumber)
	}
	if second.AuthorEmail != "alice@example.com" {
		t.Fatalf("AuthorEmail = %q", second.AuthorEmail)
	}
	if second.ChangedFiles != 1 {
		t.Fatalf("ChangedFiles = %d, want 1", second.ChangedFiles)
	}
	if len(second.Files) != 1 || second.Files[0].Filename != "main.go" {
		t.Fatalf("unexpected file stats: %#v", second.Files)
	}
}

func commitFile(t *testing.T, repoDir, name, body, when, message string) {
	t.Helper()
	path := filepath.Join(repoDir, name)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	runGit(t, repoDir, nil, "add", name)
	runGit(t, repoDir, []string{
		"GIT_AUTHOR_DATE=" + when,
		"GIT_COMMITTER_DATE=" + when,
	}, "commit", "-m", message)
}

func runGit(t *testing.T, repoDir string, extraEnv []string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", repoDir}, args...)...)
	cmd.Env = append(os.Environ(), extraEnv...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, string(out))
	}
}
