package export

import (
	"context"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/githubapi"
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

type Service struct {
	gh githubapi.Client
}

func NewService(gh githubapi.Client) *Service { return &Service{gh: gh} }

func (s *Service) ExportCSV(ctx context.Context, cfg config.ExportConfig, w io.Writer) error {
	commits, err := s.gh.ListDefaultBranchCommits(ctx, cfg.Owner, cfg.Repo, cfg.StartTime(), cfg.EndTimeInclusive())
	if err != nil {
		return err
	}

	whitelist := map[string]struct{}{}
	for _, u := range cfg.GitHubUsernames {
		whitelist[strings.ToLower(u)] = struct{}{}
	}

	seenPR := map[int]struct{}{}
	rows := make([]Row, 0, len(commits))
	for _, c := range commits {
		pr, err := s.gh.GetAssociatedMergedPR(ctx, cfg.Owner, cfg.Repo, c.SHA)
		if err != nil {
			return err
		}
		if pr == nil {
			if !cfg.IncludeDirectPush {
				continue
			}

			details, err := s.gh.GetCommitDetails(ctx, cfg.Owner, cfg.Repo, c.SHA)
			if err != nil {
				return err
			}
			if details == nil {
				return fmt.Errorf("missing commit details for %s", c.SHA)
			}

			if shouldSkipBot(details.Username, cfg.IncludeBots) {
				continue
			}
			if !allowedUser(details.Username, whitelist) {
				continue
			}

			ext := AccumulateByExtension(details.Files)
			row := BuildDirectPushRow(cfg.Owner+"/"+cfg.Repo, c, details, ext)
			rows = append(rows, row)
			continue
		}

		if _, ok := seenPR[pr.GetNumber()]; ok {
			continue
		}

		summary, err := s.gh.GetPRSummary(ctx, cfg.Owner, cfg.Repo, pr.GetNumber())
		if err != nil {
			return err
		}
		if shouldSkipBot(summary.Username, cfg.IncludeBots) {
			continue
		}
		if !allowedUser(summary.Username, whitelist) {
			continue
		}

		files, err := s.gh.ListPRFiles(ctx, cfg.Owner, cfg.Repo, summary.Number)
		if err != nil {
			return err
		}
		ext := AccumulateByExtension(files)
		row := BuildRow(cfg.Owner+"/"+cfg.Repo, c, summary, ext)
		rows = append(rows, row)
		seenPR[summary.Number] = struct{}{}
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].MergedAt.Equal(rows[j].MergedAt) {
			return rows[i].PRNumber < rows[j].PRNumber
		}
		return rows[i].MergedAt.Before(rows[j].MergedAt)
	})
	return WriteCSV(w, rows)
}

func BuildDirectPushRow(repo string, commit githubapi.BranchCommit, details *githubapi.CommitDetails, ext map[string]githubapi.ExtensionStat) Row {
	timestamp := commit.CommittedAt.UTC()
	if !details.CommittedAt.IsZero() {
		timestamp = details.CommittedAt.UTC()
	}
	row := Row{
		Repo:           repo,
		MergedAt:       timestamp,
		PRCreatedAt:    timestamp,
		CycleTimeHours: 0,
		CommitSHA:      commit.SHA,
		CommitURL:      commit.URL,
		GitHubUsername: strings.ToLower(details.Username),
		GitHubName:     details.DisplayName,
		LinesAdded:     details.Additions,
		LinesRemoved:   details.Deletions,
		FilesTouched:   details.ChangedFiles,
	}
	ApplyKnownExtensionColumns(&row, ext)
	other, _ := EncodeOtherExtensionStats(ext, []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"})
	row.OtherLinesByExtensionJSON = other
	return row
}

func BuildRow(repo string, commit githubapi.BranchCommit, pr *githubapi.PRSummary, ext map[string]githubapi.ExtensionStat) Row {
	labels := append([]string(nil), pr.Labels...)
	sort.Strings(labels)
	row := Row{
		Repo:              repo,
		MergedAt:          pr.MergedAt.UTC(),
		PRCreatedAt:       pr.CreatedAt.UTC(),
		CycleTimeHours:    pr.MergedAt.Sub(pr.CreatedAt).Hours(),
		CommitSHA:         commit.SHA,
		CommitURL:         commit.URL,
		GitHubUsername:    strings.ToLower(pr.Username),
		GitHubName:        pr.DisplayName,
		PRNumber:          pr.Number,
		PRTitle:           pr.Title,
		PRURL:             pr.URL,
		LinesAdded:        pr.Additions,
		LinesRemoved:      pr.Deletions,
		FilesTouched:      pr.ChangedFiles,
		Labels:            labels,
		AuthorAssociation: pr.AuthorAssociation,
		MergedBy:          pr.MergedBy,
		ReviewCount:       pr.ReviewCount,
		CommentCount:      pr.CommentCount,
		BaseBranch:        pr.BaseRef,
		HeadBranch:        pr.HeadRef,
		IsDraft:           pr.IsDraft,
	}
	ApplyKnownExtensionColumns(&row, ext)
	other, _ := EncodeOtherExtensionStats(ext, []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"})
	row.OtherLinesByExtensionJSON = other
	return row
}
