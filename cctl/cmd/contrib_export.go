package cmd

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"

	"github.com/coreycole/cctl/pkg/contrib/config"
	"github.com/coreycole/cctl/pkg/contrib/export"
	"github.com/spf13/cobra"
)

var exportCfg config.ExportConfig

var contribExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export contributor CSV from a local branch",
	RunE:  runContribExport,
}

func init() {
	contribExportCmd.Flags().StringVar(&exportCfg.RepoDir, "repo-dir", ".", "Local repository path")
	contribExportCmd.Flags().StringVar(&exportCfg.Branch, "branch", "main", "Branch to export")
	contribExportCmd.Flags().StringVar(&exportCfg.StartDate, "start-date", "", "Start date (YYYY-MM-DD)")
	contribExportCmd.Flags().StringVar(&exportCfg.EndDate, "end-date", "", "End date (YYYY-MM-DD)")
	contribExportCmd.Flags().StringVar(&exportCfg.Output, "output", "contributions.csv", "Output CSV path")

	_ = contribExportCmd.MarkFlagRequired("start-date")
	_ = contribExportCmd.MarkFlagRequired("end-date")

	contribCmd.AddCommand(contribExportCmd)
}

func runContribExport(cmd *cobra.Command, args []string) error {
	if err := exportCfg.Validate(); err != nil {
		return err
	}

	out, err := os.Create(exportCfg.Output)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}

	err = export.ExportLocalCSV(context.Background(), exportCfg, out)
	if closeErr := out.Close(); closeErr != nil && err == nil {
		err = fmt.Errorf("close output: %w", closeErr)
	}
	if err != nil {
		return fmt.Errorf("export failed: %w", err)
	}

	rows, err := countCSVRows(exportCfg.Output)
	if err != nil {
		return fmt.Errorf("count output rows: %w", err)
	}

	fmt.Fprintf(
		cmd.OutOrStdout(),
		"repo_dir=%s branch=%s date=%s..%s rows=%d output=%s\n",
		exportCfg.RepoDir,
		exportCfg.Branch,
		exportCfg.StartDate,
		exportCfg.EndDate,
		rows,
		exportCfg.Output,
	)
	return nil
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
