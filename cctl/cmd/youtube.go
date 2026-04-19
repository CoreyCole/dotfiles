package cmd

import "github.com/spf13/cobra"

var youtubeCmd = &cobra.Command{
	Use:   "youtube",
	Short: "YouTube note and library utilities",
}

func init() {
	rootCmd.AddCommand(youtubeCmd)
}
