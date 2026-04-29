package cmd

import (
	"strings"
	"testing"

	"github.com/coreycole/cctl/pkg/youtube/tracklist"
)

func TestRenderTracklistYAMLIncludesMusicBrainzFields(t *testing.T) {
	parsed := tracklist.Parsed{
		Category:        "dj_set",
		HasTracklist:    true,
		TracklistSource: "description",
		TrackCount:      1,
		Tracks: []tracklist.Track{{
			Start:         "00:00",
			Artist:        "Folamour",
			Title:         "These Are Just Places To Me Now",
			Status:        tracklist.StatusMatched,
			MusicBrainzID: "9120556a-ffd0-4001-84e2-d5918cf94fa9",
			ISRC:          "GBKQU1905220",
			ReleaseTitle:  "Defected Ibiza 2019",
			ReleaseDate:   "2019-05-17",
			SourceURL:     "https://musicbrainz.org/recording/9120556a-ffd0-4001-84e2-d5918cf94fa9",
		}},
	}

	out := renderTracklistYAML(parsed)
	for _, want := range []string{
		`musicbrainz_id: "9120556a-ffd0-4001-84e2-d5918cf94fa9"`,
		`isrc: "GBKQU1905220"`,
		`release_title: "Defected Ibiza 2019"`,
		`release_date: "2019-05-17"`,
		`source_url: "https://musicbrainz.org/recording/9120556a-ffd0-4001-84e2-d5918cf94fa9"`,
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("expected YAML output to include %q\n%s", want, out)
		}
	}
}
