package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/coreycole/cctl/pkg/youtube/notes"
	"github.com/spf13/cobra"
)

var (
	youtubePlanRoot   string
	youtubePlanFormat string
)

var youtubePlanLayoutCmd = &cobra.Command{
	Use:   "plan-layout",
	Short: "Generate a deterministic dry-run migration plan for YouTube notes",
	RunE:  runYouTubePlanLayout,
}

func init() {
	home, _ := os.UserHomeDir()
	defaultRoot := filepath.Join(home, ".hermes", "notes", "videos")
	youtubePlanLayoutCmd.Flags().StringVar(&youtubePlanRoot, "root", defaultRoot, "Root video notes directory to scan")
	youtubePlanLayoutCmd.Flags().StringVar(&youtubePlanFormat, "format", "json", "Output format: json or text")
	youtubeCmd.AddCommand(youtubePlanLayoutCmd)
}

func runYouTubePlanLayout(cmd *cobra.Command, args []string) error {
	plan, err := notes.PlanLibrary(youtubePlanRoot)
	if err != nil {
		return err
	}

	switch youtubePlanFormat {
	case "json":
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(plan)
	case "text":
		fmt.Print(renderPlanText(plan))
		return nil
	default:
		return fmt.Errorf("unsupported format %q (want json or text)", youtubePlanFormat)
	}
}

func renderPlanText(plan *notes.Plan) string {
	out := ""
	out += fmt.Sprintf("Moves: %d\n", len(plan.Moves))
	for _, move := range plan.Moves {
		out += fmt.Sprintf("- %s -> %s\n", move.OldPath, move.NewPath)
	}

	keys := make([]string, 0, len(plan.Channels))
	for key := range plan.Channels {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	out += fmt.Sprintf("\nChannels: %d\n", len(plan.Channels))
	for _, key := range keys {
		channel := plan.Channels[key]
		out += fmt.Sprintf("- %s => %s (%s)\n", key, channel.DirName, channel.DisplayName)
	}
	out += fmt.Sprintf("\nManual review: %d\n", len(plan.Review))
	for _, item := range plan.Review {
		out += fmt.Sprintf("- %s: %s\n", item.Path, item.Reason)
	}
	return out
}
