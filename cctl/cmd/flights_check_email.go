package cmd

import (
	"fmt"

	"github.com/coreycole/cctl/pkg/flights"
	"github.com/spf13/cobra"
)

var flightsCheckEmailCfg flights.Config

var flightsCheckEmailCmd = &cobra.Command{
	Use:   "check-email",
	Short: "Ingest unread Going deal emails into destination-organized markdown notes",
	RunE:  runFlightsCheckEmail,
}

func init() {
	flightsCheckEmailCmd.Flags().StringVar(&flightsCheckEmailCfg.Query, "query", flights.DefaultQuery(), "Gmail search query for Going deals")
	flightsCheckEmailCmd.Flags().IntVar(&flightsCheckEmailCfg.MaxResults, "max-results", 10, "Maximum unread messages to inspect")
	flightsCheckEmailCmd.Flags().BoolVar(&flightsCheckEmailCfg.DryRun, "dry-run", false, "Parse and plan note writes without writing files or marking messages read")
	flightsCheckEmailCmd.Flags().StringVar(&flightsCheckEmailCfg.RootDir, "root", flights.DefaultRootDir(), "Root directory for flight notes")
	flightsCheckEmailCmd.Flags().StringVar(&flightsCheckEmailCfg.Account, "account", flights.DefaultAccount(), "Gmail account to query with gog")
	flightsCheckEmailCmd.Flags().StringVar(&flightsCheckEmailCfg.GogBin, "gog-bin", "gog", "gog binary to use")
	flightsCmd.AddCommand(flightsCheckEmailCmd)
}

func runFlightsCheckEmail(cmd *cobra.Command, args []string) error {
	cfg, err := flightsCheckEmailCfg.Validate()
	if err != nil {
		return err
	}
	result, err := flights.CheckEmail(cmd.Context(), cfg)
	if err != nil {
		return err
	}

	for _, notePath := range result.Notes {
		fmt.Fprintln(cmd.OutOrStdout(), notePath)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "processed=%d written=%d skipped=%d marked_read=%d dry_run=%t\n", result.Processed, result.Written, result.Skipped, result.MarkedRead, cfg.DryRun)
	return nil
}
