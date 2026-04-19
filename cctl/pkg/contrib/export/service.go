package export

import (
	"context"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/localgit"
)

type Row struct {
	Repo                      string
	MergedAt                  time.Time
	PRCreatedAt               time.Time
	CycleTimeHours            float64
	CommitSHA                 string
	CommitURL                 string
	GitHubUsername            string
	GitHubName                string
	PRNumber                  int
	PRTitle                   string
	PRURL                     string
	LinesAdded                int
	LinesRemoved              int
	FilesTouched              int
	Labels                    []string
	AuthorAssociation         string
	MergedBy                  string
	ReviewCount               int
	CommentCount              int
	BaseBranch                string
	HeadBranch                string
	IsDraft                   bool
	GoLinesAdded              int
	GoLinesRemoved            int
	GoFilesTouched            int
	ProtoLinesAdded           int
	ProtoLinesRemoved         int
	ProtoFilesTouched         int
	SQLLinesAdded             int
	SQLLinesRemoved           int
	SQLFilesTouched           int
	MDLinesAdded              int
	MDLinesRemoved            int
	MDFilesTouched            int
	TSLinesAdded              int
	TSLinesRemoved            int
	TSFilesTouched            int
	TSXLinesAdded             int
	TSXLinesRemoved           int
	TSXFilesTouched           int
	OtherLinesByExtensionJSON string
}

var knownExtensions = []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"}

func ExportLocalCSV(ctx context.Context, cfg config.ExportConfig, w io.Writer) error {
	commits, err := localgit.New().ListBranchCommits(ctx, cfg)
	if err != nil {
		return err
	}

	rows := make([]Row, 0, len(commits))
	for _, commit := range commits {
		rows = append(rows, BuildLocalRow(commit))
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].MergedAt.Equal(rows[j].MergedAt) {
			return rows[i].CommitSHA < rows[j].CommitSHA
		}
		return rows[i].MergedAt.Before(rows[j].MergedAt)
	})

	return WriteCSV(w, rows)
}

func BuildLocalRow(commit localgit.CommitRecord) Row {
	ext := AccumulateByExtension(commit.Files)
	row := Row{
		Repo:           commit.RepoLabel,
		MergedAt:       commit.CommittedAt.UTC(),
		PRCreatedAt:    commit.CommittedAt.UTC(),
		CycleTimeHours: 0,
		CommitSHA:      commit.SHA,
		CommitURL:      localgit.CommitURL(commit.RepoWebURL, commit.SHA),
		GitHubUsername: localIdentity(commit.AuthorEmail, commit.AuthorName),
		GitHubName:     strings.TrimSpace(commit.AuthorName),
		PRNumber:       commit.PRNumber,
		PRTitle:        strings.TrimSpace(commit.Message),
		PRURL:          localgit.PRURL(commit.RepoWebURL, commit.PRNumber),
		LinesAdded:     commit.Additions,
		LinesRemoved:   commit.Deletions,
		FilesTouched:   commit.ChangedFiles,
	}
	ApplyKnownExtensionColumns(&row, ext)
	other, _ := EncodeOtherExtensionStats(ext, knownExtensions)
	row.OtherLinesByExtensionJSON = other
	return row
}

func localIdentity(email, name string) string {
	if v := strings.ToLower(strings.TrimSpace(email)); v != "" {
		return v
	}
	return strings.ToLower(strings.TrimSpace(name))
}
