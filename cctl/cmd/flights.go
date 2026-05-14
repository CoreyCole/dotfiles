package cmd

import "github.com/spf13/cobra"

var flightsCmd = &cobra.Command{
	Use:   "flights",
	Short: "Flight deal ingestion and note tools",
}

func init() {
	rootCmd.AddCommand(flightsCmd)
}
