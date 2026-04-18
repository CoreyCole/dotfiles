package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/export"
	"github.com/coreycole/cctl/pkg/contrib/githubapi"
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
	if exportCfg.GitHubToken == "" {
		exportCfg.GitHubToken = os.Getenv("GITHUB_TOKEN")
	}
	exportCfg.KnownExtensions = []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"}

	if err := exportCfg.Validate(); err != nil {
		return err
	}

	gh, err := githubapi.NewClient(exportCfg.GitHubToken)
	if err != nil {
		return err
	}

	f, err := os.Create(exportCfg.Output)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	defer f.Close()

	svc := export.NewService(gh)
	if err := svc.ExportCSV(context.Background(), exportCfg, f); err != nil {
		return err
	}

	fmt.Fprintf(cmd.OutOrStdout(), "wrote %s\n", exportCfg.Output)
	return nil
}
