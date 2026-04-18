package cmd

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/export"
	"github.com/coreycole/cctl/pkg/contrib/githubapi"
	"github.com/google/go-github/v69/github"
	"github.com/spf13/cobra"
)

var exportCfg config.ExportConfig

var contribExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export contributor CSV from merged PRs",
	RunE:  runContribExport,
}

func init() {
	contribExportCmd.Flags().StringVar(&exportCfg.Owner, "owner", "", "GitHub owner/org")
	contribExportCmd.Flags().StringVar(&exportCfg.Repo, "repo", "", "GitHub repository")
	contribExportCmd.Flags().StringVar(&exportCfg.StartDate, "start-date", "", "Start date (YYYY-MM-DD)")
	contribExportCmd.Flags().StringVar(&exportCfg.EndDate, "end-date", "", "End date (YYYY-MM-DD)")
	contribExportCmd.Flags().StringVar(&exportCfg.Output, "output", "contributions.csv", "Output CSV path")
	contribExportCmd.Flags().StringVar(&exportCfg.GitHubToken, "github-token", "", "GitHub token (defaults to GITHUB_TOKEN)")
	contribExportCmd.Flags().StringSliceVar(&exportCfg.GitHubUsernames, "github-username", nil, "Allowed GitHub username(s), repeat or comma-separated")
	contribExportCmd.Flags().BoolVar(&exportCfg.IncludeBots, "include-bots", false, "Include bot users")
	contribExportCmd.Flags().BoolVar(&exportCfg.IncludeDirectPush, "include-direct-push", false, "Include commits not associated with merged PRs")

	_ = contribExportCmd.MarkFlagRequired("owner")
	_ = contribExportCmd.MarkFlagRequired("repo")
	_ = contribExportCmd.MarkFlagRequired("start-date")
	_ = contribExportCmd.MarkFlagRequired("end-date")

	contribCmd.AddCommand(contribExportCmd)
}

func runContribExport(cmd *cobra.Command, args []string) error {
	if strings.TrimSpace(exportCfg.GitHubToken) == "" {
		exportCfg.GitHubToken = os.Getenv("GITHUB_TOKEN")
	}
	exportCfg.KnownExtensions = []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"}

	if err := exportCfg.Validate(); err != nil {
		return err
	}
	if err := ensureHasToken(exportCfg.GitHubToken); err != nil {
		return err
	}

	gh, err := githubapi.NewClient(exportCfg.GitHubToken)
	if err != nil {
		return err
	}

	out, err := os.Create(exportCfg.Output)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}

	svc := export.NewService(gh)
	err = svc.ExportCSV(context.Background(), exportCfg, out)
	if closeErr := out.Close(); closeErr != nil && err == nil {
		err = fmt.Errorf("close output: %w", closeErr)
	}
	if err != nil {
		return handleExportError(err)
	}

	rows, err := countCSVRows(exportCfg.Output)
	if err != nil {
		return fmt.Errorf("count output rows: %w", err)
	}

	fmt.Fprintf(cmd.OutOrStdout(), "owner=%s repo=%s date=%s..%s rows=%d output=%s\n", exportCfg.Owner, exportCfg.Repo, exportCfg.StartDate, exportCfg.EndDate, rows, exportCfg.Output)
	return nil
}

func ensureHasToken(token string) error {
	if strings.TrimSpace(token) == "" {
		return fmt.Errorf("missing GitHub token: set --github-token or GITHUB_TOKEN")
	}
	return nil
}

func handleExportError(err error) error {
	var rateErr *github.RateLimitError
	if errors.As(err, &rateErr) {
		resetsAt := "unknown"
		if !rateErr.Rate.Reset.IsZero() {
			resetsAt = rateErr.Rate.Reset.Format(time.RFC3339)
		}
		return fmt.Errorf("GitHub rate limit exceeded (limit=%d, resets=%s)", rateErr.Rate.Limit, resetsAt)
	}
	return fmt.Errorf("export failed: %w", err)
}

func countCSVRows(path string) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	if _, err := r.Read(); err != nil {
		if err == io.EOF {
			return 0, nil
		}
		return 0, fmt.Errorf("read header: %w", err)
	}

	count := 0
	for {
		if _, err := r.Read(); err != nil {
			if err == io.EOF {
				return count, nil
			}
			return 0, fmt.Errorf("read data rows: %w", err)
		}
		count++
	}
}
