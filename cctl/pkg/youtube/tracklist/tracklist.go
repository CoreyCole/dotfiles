package tracklist

import (
	"regexp"
	"strings"
)

const (
	StatusMatched          = "matched"
	StatusPartial          = "partial"
	timestampSubmatchCount = 3
)

type Track struct {
	Start         string `json:"start"`
	Artist        string `json:"artist,omitempty"`
	Title         string `json:"title,omitempty"`
	Mix           string `json:"mix,omitempty"`
	Status        string `json:"status"`
	Notes         string `json:"notes,omitempty"`
	Raw           string `json:"raw"`
	BPMCatalog    any    `json:"bpm_catalog,omitempty"`
	KeyCatalog    any    `json:"key_catalog,omitempty"`
	MusicBrainzID string `json:"musicbrainz_id,omitempty"`
	ISRC          string `json:"isrc,omitempty"`
	ReleaseTitle  string `json:"release_title,omitempty"`
	ReleaseDate   string `json:"release_date,omitempty"`
	SourceURL     string `json:"source_url,omitempty"`
}

type Parsed struct {
	Category        string  `json:"category"`
	HasTracklist    bool    `json:"has_tracklist"`
	TracklistSource string  `json:"tracklist_source,omitempty"`
	TrackCount      int     `json:"track_count"`
	Tracks          []Track `json:"tracks,omitempty"`
}

var (
	tracklistHeaderPattern = regexp.MustCompile(
		`(?i)(?:^|\b)track\s*list\s*` +
			`(?:official|oficial)?\s*:`,
	)
	timestampPattern = regexp.MustCompile(`^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)\s*$`)
	separatorPattern = regexp.MustCompile(`\s+[–—-]\s+`)
	parenMixPattern  = regexp.MustCompile(
		`(?i)\(([^()]*(?:mix|remix|edit|dub|version))\)$`,
	)
)

func ParseDescription(description string) Parsed {
	lines := strings.Split(description, "\n")
	inTracklist := false
	tracks := make([]Track, 0)

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !inTracklist {
			if tracklistHeaderPattern.MatchString(trimmed) {
				inTracklist = true
			}
			continue
		}

		if trimmed == "" {
			if len(tracks) > 0 {
				break
			}
			continue
		}

		track, ok := ParseLine(trimmed)
		if !ok {
			if len(tracks) > 0 {
				break
			}
			continue
		}
		tracks = append(tracks, track)
	}

	parsed := Parsed{
		TrackCount: len(tracks),
		Tracks:     tracks,
	}
	if len(tracks) > 0 {
		parsed.Category = "dj_set"
		parsed.HasTracklist = true
		parsed.TracklistSource = "description"
	}
	return parsed
}

func ParseLine(line string) (Track, bool) {
	trimmed := strings.TrimSpace(line)
	start := ""
	rest := trimmed
	m := timestampPattern.FindStringSubmatch(trimmed)
	if len(m) == timestampSubmatchCount {
		start = m[1]
		rest = strings.TrimSpace(m[2])
	}
	track := Track{Start: start, Raw: line, Status: StatusPartial}

	parts := separatorPattern.Split(rest, 2)
	if len(parts) == 2 {
		track.Artist = strings.TrimSpace(parts[0])
		title := strings.TrimSpace(parts[1])
		track.Title, track.Mix = extractMix(title)
		track.Status = StatusMatched
		return track, true
	}

	if start == "" {
		return Track{}, false
	}

	track.Title = rest
	track.Notes = "Tracklist line missing artist/title separator"
	return track, true
}

func extractMix(title string) (string, string) {
	title = strings.TrimSpace(title)
	mixMatch := parenMixPattern.FindStringSubmatch(title)
	if len(mixMatch) == 2 {
		mix := strings.TrimSpace(mixMatch[1])
		title = strings.TrimSpace(strings.TrimSuffix(title, mixMatch[0]))
		return title, mix
	}

	openIdx := strings.Index(title, "(")
	closeIdx := strings.LastIndex(title, ")")
	if openIdx >= 0 && closeIdx == len(title)-1 && closeIdx > openIdx {
		mix := strings.TrimSpace(title[openIdx+1 : closeIdx])
		lowerMix := strings.ToLower(mix)
		isMix := strings.Contains(lowerMix, "mix") ||
			strings.Contains(lowerMix, "remix") ||
			strings.Contains(lowerMix, "edit") ||
			strings.Contains(lowerMix, "dub") ||
			strings.Contains(lowerMix, "version")
		if isMix {
			return strings.TrimSpace(title[:openIdx]), mix
		}
	}
	return title, ""
}
