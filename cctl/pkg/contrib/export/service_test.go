package export

import (
	"bytes"
	"context"
	"encoding/csv"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/localgit"
)

func TestBuildLocalRowBlankPRFieldsWhenMissing(t *testing.T) {
	row := BuildLocalRow(localgit.CommitRecord{
		RepoLabel:    "coreycole/cctl",
		RepoWebURL:   "https://github.com/coreycole/cctl",
		SHA:          "abc123",
		Message:      "docs: cleanup",
		AuthorName:   "Alice Example",
		AuthorEmail:  "alice@example.com",
		CommittedAt:  time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC),
		Additions:    3,
		Deletions:    1,
		ChangedFiles: 1,
		Files: []localgit.CommitFile{{
			Filename:  "README.md",
			Additions: 3,
			Deletions: 1,
			Changes:   4,
		}},
	})

	if row.PRNumber != 0 {
		t.Fatalf("PRNumber = %d, want 0", row.PRNumber)
	}
	if row.PRURL != "" {
		t.Fatalf("PRURL = %q, want empty", row.PRURL)
	}
	if row.GitHubUsername != "alice@example.com" {
		t.Fatalf("GitHubUsername = %q", row.GitHubUsername)
	}
	if row.MDFilesTouched != 1 {
		t.Fatalf("MDFilesTouched = %d, want 1", row.MDFilesTouched)
	}

	record := Record(row)
	if record[8] != "" {
		t.Fatalf("csv pr_number = %q, want empty", record[8])
	}
}

func TestBuildLocalRowPopulatesURLsAndExtensions(t *testing.T) {
	row := BuildLocalRow(localgit.CommitRecord{
		RepoLabel:    "coreycole/cctl",
		RepoWebURL:   "https://github.com/coreycole/cctl",
		SHA:          "def456",
		Message:      "add export path (#42)",
		AuthorName:   "Alice Example",
		AuthorEmail:  "alice@example.com",
		CommittedAt:  time.Date(2026, 1, 3, 12, 0, 0, 0, time.UTC),
		Additions:    7,
		Deletions:    2,
		ChangedFiles: 2,
		PRNumber:     42,
		Files: []localgit.CommitFile{
			{Filename: "main.go", Additions: 5, Deletions: 1, Changes: 6},
			{Filename: "README.md", Additions: 2, Deletions: 1, Changes: 3},
		},
	})

	if row.CommitURL != "https://github.com/coreycole/cctl/commit/def456" {
		t.Fatalf("CommitURL = %q", row.CommitURL)
	}
	if row.PRURL != "https://github.com/coreycole/cctl/pull/42" {
		t.Fatalf("PRURL = %q", row.PRURL)
	}
	if row.GoFilesTouched != 1 || row.MDFilesTouched != 1 {
		t.Fatalf("unexpected extension counts: %#v", row)
	}
}

func TestExportLocalCSVWritesOneRowPerCommit(t *testing.T) {
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

	var buf bytes.Buffer
	if err := ExportLocalCSV(context.Background(), cfg, &buf); err != nil {
		t.Fatalf("ExportLocalCSV: %v", err)
	}

	records := parseCSVRecords(t, buf.String())
	if len(records) != 3 {
		t.Fatalf("got %d csv lines, want 3", len(records))
	}
	if records[1][9] != "initial commit" {
		t.Fatalf("first row title = %q", records[1][9])
	}
	if records[2][8] != "42" {
		t.Fatalf("second row pr_number = %q, want 42", records[2][8])
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

func parseCSVRecords(t *testing.T, output string) [][]string {
	t.Helper()
	r := csv.NewReader(strings.NewReader(output))
	records, err := r.ReadAll()
	if err != nil {
		t.Fatalf("parse csv: %v", err)
	}
	return records
}
