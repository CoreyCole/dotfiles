package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/coreycole/cctl/pkg/youtube/notes"
	"github.com/spf13/cobra"
)

var youtubeApplyLayoutRoot string

var youtubeApplyLayoutCmd = &cobra.Command{
	Use:   "apply-layout",
	Short: "Apply the planned YouTube note migration",
	RunE:  runYouTubeApplyLayout,
}

func init() {
	home, _ := os.UserHomeDir()
	defaultRoot := filepath.Join(home, ".hermes", "notes", "videos")
	youtubeApplyLayoutCmd.Flags().StringVar(&youtubeApplyLayoutRoot, "root", defaultRoot, "Root video notes directory to migrate")
	youtubeCmd.AddCommand(youtubeApplyLayoutCmd)
}

func runYouTubeApplyLayout(cmd *cobra.Command, args []string) error {
	plan, err := notes.ApplyLayout(youtubeApplyLayoutRoot)
	if err != nil {
		return err
	}

	indexDir := filepath.Join(youtubeApplyLayoutRoot, ".index")
	fmt.Fprintf(
		cmd.OutOrStdout(),
		"root=%s moved=%d channels=%d videos=%d review=%d channels_index=%s videos_index=%s\n",
		youtubeApplyLayoutRoot,
		len(plan.Moves),
		len(plan.Channels),
		len(plan.Videos),
		len(plan.Review),
		filepath.Join(indexDir, "channels.json"),
		filepath.Join(indexDir, "videos.json"),
	)
	return nil
}
