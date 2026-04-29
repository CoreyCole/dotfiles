package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/coreycole/cctl/pkg/youtube/tracklist"
	"github.com/spf13/cobra"
)

var (
	youtubeTracklistFormat            string
	youtubeTracklistDescriptionFile   string
	youtubeTracklistYTDLPBin          string
	youtubeTracklistEnrichMusicBrainz bool
)

var youtubeTracklistCmd = &cobra.Command{
	Use:   "tracklist [youtube-url]",
	Short: "Parse a YouTube DJ-set description tracklist into structured data",
	Args: func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 && strings.TrimSpace(youtubeTracklistDescriptionFile) == "" {
			return fmt.Errorf("provide a YouTube URL or --description-file")
		}
		if len(args) > 1 {
			return fmt.Errorf("accepts at most one YouTube URL")
		}
		return nil
	},
	RunE: runYouTubeTracklist,
}

func init() {
	youtubeTracklistCmd.Flags().StringVar(&youtubeTracklistFormat, "format", "yaml", "Output format: yaml or json")
	youtubeTracklistCmd.Flags().StringVar(&youtubeTracklistDescriptionFile, "description-file", "", "Read description text from a local file instead of yt-dlp")
	youtubeTracklistCmd.Flags().StringVar(&youtubeTracklistYTDLPBin, "yt-dlp-bin", "yt-dlp", "yt-dlp binary to use when fetching from a URL")
	youtubeTracklistCmd.Flags().BoolVar(&youtubeTracklistEnrichMusicBrainz, "enrich-musicbrainz", false, "Enrich matched tracks with MusicBrainz metadata")
	youtubeCmd.AddCommand(youtubeTracklistCmd)
}

func runYouTubeTracklist(cmd *cobra.Command, args []string) error {
	description, err := loadTracklistDescription(args)
	if err != nil {
		return err
	}
	parsed := tracklist.ParseDescription(description)
	if youtubeTracklistEnrichMusicBrainz && len(parsed.Tracks) > 0 {
		enricher := &tracklist.MusicBrainzEnricher{UserAgent: "cctl/tracklist (+contact.creativemode.ai@gmail.com)"}
		tracks, err := enricher.EnrichTracks(context.Background(), parsed.Tracks)
		if err != nil {
			return err
		}
		parsed.Tracks = tracks
	}

	switch youtubeTracklistFormat {
	case "json":
		enc := json.NewEncoder(cmd.OutOrStdout())
		enc.SetIndent("", "  ")
		return enc.Encode(parsed)
	case "yaml":
		_, err := fmt.Fprint(cmd.OutOrStdout(), renderTracklistYAML(parsed))
		return err
	default:
		return fmt.Errorf("unsupported format %q (want yaml or json)", youtubeTracklistFormat)
	}
}

func loadTracklistDescription(args []string) (string, error) {
	if strings.TrimSpace(youtubeTracklistDescriptionFile) != "" {
		data, err := os.ReadFile(youtubeTracklistDescriptionFile)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}
	url := args[0]
	out, err := exec.Command(youtubeTracklistYTDLPBin, "--print", "description", url).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("yt-dlp description fetch failed: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func renderTracklistYAML(parsed tracklist.Parsed) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("category: %s\n", parsed.Category))
	if parsed.HasTracklist {
		b.WriteString("has_tracklist: true\n")
		b.WriteString(fmt.Sprintf("tracklist_source: %s\n", parsed.TracklistSource))
	} else {
		b.WriteString("has_tracklist: false\n")
	}
	b.WriteString(fmt.Sprintf("track_count: %d\n", parsed.TrackCount))
	if len(parsed.Tracks) == 0 {
		return b.String()
	}
	b.WriteString("tracks:\n")
	for _, track := range parsed.Tracks {
		b.WriteString(fmt.Sprintf("  - start: %q\n", track.Start))
		if track.Artist != "" {
			b.WriteString(fmt.Sprintf("    artist: %q\n", track.Artist))
		}
		if track.Title != "" {
			b.WriteString(fmt.Sprintf("    title: %q\n", track.Title))
		}
		if track.Mix != "" {
			b.WriteString(fmt.Sprintf("    mix: %q\n", track.Mix))
		}
		b.WriteString(fmt.Sprintf("    status: %s\n", track.Status))
		if track.Notes != "" {
			b.WriteString(fmt.Sprintf("    notes: %q\n", track.Notes))
		}
		if track.MusicBrainzID != "" {
			b.WriteString(fmt.Sprintf("    musicbrainz_id: %q\n", track.MusicBrainzID))
		}
		if track.ISRC != "" {
			b.WriteString(fmt.Sprintf("    isrc: %q\n", track.ISRC))
		}
		if track.ReleaseTitle != "" {
			b.WriteString(fmt.Sprintf("    release_title: %q\n", track.ReleaseTitle))
		}
		if track.ReleaseDate != "" {
			b.WriteString(fmt.Sprintf("    release_date: %q\n", track.ReleaseDate))
		}
		if track.SourceURL != "" {
			b.WriteString(fmt.Sprintf("    source_url: %q\n", track.SourceURL))
		}
		b.WriteString("    bpm_catalog: null\n")
		b.WriteString("    key_catalog: null\n")
	}
	return b.String()
}
