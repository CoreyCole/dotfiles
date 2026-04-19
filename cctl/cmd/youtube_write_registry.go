package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/coreycole/cctl/pkg/youtube/notes"
	"github.com/spf13/cobra"
)

var youtubeWriteRegistryRoot string

var youtubeWriteRegistryCmd = &cobra.Command{
	Use:   "write-registry",
	Short: "Write planned YouTube channel and video registries",
	RunE:  runYouTubeWriteRegistry,
}

func init() {
	home, _ := os.UserHomeDir()
	defaultRoot := filepath.Join(home, ".hermes", "notes", "videos")
	youtubeWriteRegistryCmd.Flags().StringVar(&youtubeWriteRegistryRoot, "root", defaultRoot, "Root video notes directory to scan")
	youtubeCmd.AddCommand(youtubeWriteRegistryCmd)
}

func runYouTubeWriteRegistry(cmd *cobra.Command, args []string) error {
	plan, err := notes.WriteRegistries(youtubeWriteRegistryRoot)
	if err != nil {
		return err
	}

	indexDir := filepath.Join(youtubeWriteRegistryRoot, ".index")
	fmt.Fprintf(
		cmd.OutOrStdout(),
		"root=%s channels=%d videos=%d review=%d channels_index=%s videos_index=%s\n",
		youtubeWriteRegistryRoot,
		len(plan.Channels),
		len(plan.Videos),
		len(plan.Review),
		filepath.Join(indexDir, "channels.json"),
		filepath.Join(indexDir, "videos.json"),
	)
	return nil
}
