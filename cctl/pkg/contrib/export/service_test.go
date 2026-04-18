package export

import (
	"bytes"
	"context"
	"encoding/csv"
	"strings"
	"testing"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/githubapi"
	"github.com/google/go-github/v69/github"
)

type fakeGitHubClient struct {
	commits []githubapi.BranchCommit

	associatedPRBySHA  map[string]*githubapi.PRSummary
	filesByPR          map[int][]githubapi.PRFile
	prSummariesByNum   map[int]*githubapi.PRSummary
	commitDetailsBySHA map[string]*githubapi.CommitDetails
}

func (f *fakeGitHubClient) ListDefaultBranchCommits(_ context.Context, _, _ string, _, _ time.Time) ([]githubapi.BranchCommit, error) {
	return f.commits, nil
}

func (f *fakeGitHubClient) GetAssociatedMergedPR(_ context.Context, _, _ string, sha string) (*github.PullRequest, error) {
	summary := f.associatedPRBySHA[sha]
	if summary == nil {
		return nil, nil
	}
	return &github.PullRequest{
		Number:   github.Int(summary.Number),
		MergedAt: &github.Timestamp{Time: summary.MergedAt},
	}, nil
}

func (f *fakeGitHubClient) GetPRSummary(_ context.Context, _, _ string, number int) (*githubapi.PRSummary, error) {
	return f.prSummariesByNum[number], nil
}

func (f *fakeGitHubClient) ListPRFiles(_ context.Context, _, _ string, number int) ([]githubapi.PRFile, error) {
	return f.filesByPR[number], nil
}

func (f *fakeGitHubClient) GetCommitDetails(_ context.Context, _, _ string, sha string) (*githubapi.CommitDetails, error) {
	return f.commitDetailsBySHA[sha], nil
}

func TestExportSkipsDuplicatePRRows(t *testing.T) {
	service := NewService(&fakeGitHubClient{
		commits: []githubapi.BranchCommit{
			{SHA: "c1", CommittedAt: parseTime(t, "2026-01-02T00:00:00Z")},
			{SHA: "c2", CommittedAt: parseTime(t, "2026-01-02T01:00:00Z")},
		},
		associatedPRBySHA: map[string]*githubapi.PRSummary{
			"c1": {Number: 1},
			"c2": {Number: 1},
		},
		prSummariesByNum: map[int]*githubapi.PRSummary{
			1: {
				Number:            1,
				Title:             "Dup PR",
				URL:               "https://github.com/o/r/pull/1",
				Username:          "alice",
				MergedAt:          parseTime(t, "2026-01-03T00:00:00Z"),
				CreatedAt:         parseTime(t, "2026-01-01T00:00:00Z"),
				Labels:            []string{"bug"},
				ReviewCount:       0,
				CommentCount:      0,
				ChangedFiles:      1,
				BaseRef:           "main",
				HeadRef:           "feat/test",
				AuthorAssociation: "OWNER",
			},
		},
		filesByPR: map[int][]githubapi.PRFile{
			1: {{Filename: "a.go", Additions: 10, Deletions: 1}},
		},
	})
	cfg := config.ExportConfig{Owner: "o", Repo: "r", StartDate: "2026-01-01", EndDate: "2026-01-31"}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := service.ExportCSV(context.Background(), cfg, &buf); err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	if csvLineCount(t, buf.String()) != 2 {
		t.Fatalf("expected 2 lines, got %d", csvLineCount(t, buf.String()))
	}
}

func TestExportWhitelistFilterIsCaseInsensitive(t *testing.T) {
	service := NewService(&fakeGitHubClient{
		commits: []githubapi.BranchCommit{{SHA: "c1", CommittedAt: parseTime(t, "2026-01-02T00:00:00Z")}},
		associatedPRBySHA: map[string]*githubapi.PRSummary{
			"c1": {Number: 1},
		},
		prSummariesByNum: map[int]*githubapi.PRSummary{
			1: {
				Number:            1,
				Title:             "Case",
				URL:               "https://github.com/o/r/pull/1",
				Username:          "Alice",
				MergedAt:          parseTime(t, "2026-01-02T00:00:00Z"),
				CreatedAt:         parseTime(t, "2026-01-01T00:00:00Z"),
				AuthorAssociation: "OWNER",
			},
		},
		filesByPR: map[int][]githubapi.PRFile{
			1: {},
		},
	})
	cfg := config.ExportConfig{Owner: "o", Repo: "r", StartDate: "2026-01-01", EndDate: "2026-01-31", GitHubUsernames: []string{"aLiCe"}}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := service.ExportCSV(context.Background(), cfg, &buf); err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	if csvLineCount(t, buf.String()) != 2 {
		t.Fatalf("expected 2 lines, got %d", csvLineCount(t, buf.String()))
	}
}

func TestExportSkipsBotByDefault(t *testing.T) {
	service := NewService(&fakeGitHubClient{
		commits: []githubapi.BranchCommit{{SHA: "c1", CommittedAt: parseTime(t, "2026-01-02T00:00:00Z")}},
		associatedPRBySHA: map[string]*githubapi.PRSummary{
			"c1": {Number: 1},
		},
		prSummariesByNum: map[int]*githubapi.PRSummary{
			1: {
				Number:            1,
				Title:             "Bot PR",
				URL:               "https://github.com/o/r/pull/1",
				Username:          "dependabot[bot]",
				MergedAt:          parseTime(t, "2026-01-02T00:00:00Z"),
				CreatedAt:         parseTime(t, "2026-01-01T00:00:00Z"),
				AuthorAssociation: "NONE",
			},
		},
		filesByPR: map[int][]githubapi.PRFile{
			1: {},
		},
	})
	cfg := config.ExportConfig{Owner: "o", Repo: "r", StartDate: "2026-01-01", EndDate: "2026-01-31"}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := service.ExportCSV(context.Background(), cfg, &buf); err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	if csvLineCount(t, buf.String()) != 1 {
		t.Fatalf("expected 1 line, got %d", csvLineCount(t, buf.String()))
	}
}

func TestExportIncludesDirectPushRowsWithEmptyPRNumber(t *testing.T) {
	service := NewService(&fakeGitHubClient{
		commits: []githubapi.BranchCommit{
			{SHA: "c1", CommittedAt: parseTime(t, "2026-01-01T00:00:00Z")},
			{SHA: "c2", CommittedAt: parseTime(t, "2026-01-02T00:00:00Z")},
		},
		associatedPRBySHA: map[string]*githubapi.PRSummary{
			"c2": {Number: 3},
		},
		commitDetailsBySHA: map[string]*githubapi.CommitDetails{
			"c1": {
				SHA:          "c1",
				Additions:    3,
				Deletions:    1,
				ChangedFiles: 2,
				Username:     "Alice",
				DisplayName:  "Alice",
				Files: []githubapi.PRFile{
					{Filename: "readme.md", Additions: 2, Deletions: 1, Changes: 3},
				},
			},
		},
		prSummariesByNum: map[int]*githubapi.PRSummary{
			3: {
				Number:            3,
				Title:             "Has PR",
				URL:               "https://github.com/o/r/pull/3",
				Username:          "alice",
				MergedAt:          parseTime(t, "2026-01-03T00:00:00Z"),
				CreatedAt:         parseTime(t, "2026-01-02T00:00:00Z"),
				AuthorAssociation: "OWNER",
			},
		},
		filesByPR: map[int][]githubapi.PRFile{
			3: {{Filename: "main.go", Additions: 10, Deletions: 0}},
		},
	})
	cfg := config.ExportConfig{Owner: "o", Repo: "r", StartDate: "2026-01-01", EndDate: "2026-01-31", IncludeDirectPush: true}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := service.ExportCSV(context.Background(), cfg, &buf); err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}

	records, err := parseCSVRecords(buf.String())
	if err != nil {
		t.Fatalf("parsing csv: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("expected 2 data rows + header, got %d", len(records))
	}

	var directPushFound bool
	for i, row := range records[1:] {
		if row[8] == "" {
			directPushFound = true
			if row[10] != "" {
				t.Fatalf("direct push row should not have PR URL")
			}
			if row[11] != "3" {
				t.Fatalf("direct push lines_added expected 3 got %q", row[11])
			}
			if row[12] != "1" {
				t.Fatalf("direct push lines_removed expected 1 got %q", row[12])
			}
			if row[8] != "" {
				t.Fatalf("row %d expected empty PR number", i+2)
			}
		}
	}
	if !directPushFound {
		t.Fatalf("direct push row not found")
	}
}

func parseTime(t *testing.T, s string) time.Time {
	t.Helper()
	v, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatalf("parseTime %q: %v", s, err)
	}
	return v
}

func csvLineCount(t *testing.T, output string) int {
	t.Helper()
	records, err := parseCSVRecords(output)
	if err != nil {
		t.Fatalf("parse csv: %v", err)
	}
	return len(records)
}

func parseCSVRecords(output string) ([][]string, error) {
	if output == "" {
		return nil, nil
	}
	r := csv.NewReader(strings.NewReader(output))
	return r.ReadAll()
}
