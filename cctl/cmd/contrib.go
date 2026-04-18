package cmd

import "github.com/spf13/cobra"

var contribCmd = &cobra.Command{
	Use:   "contrib",
	Short: "Contributor analysis tools",
}

func init() {
	rootCmd.AddCommand(contribCmd)
}
