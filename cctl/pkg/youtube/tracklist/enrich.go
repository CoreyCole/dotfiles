package tracklist

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const defaultMusicBrainzBaseURL = "https://musicbrainz.org/ws/2"

type MusicBrainzEnricher struct {
	BaseURL    string
	HTTPClient *http.Client
	UserAgent  string
}

type musicBrainzResponse struct {
	Recordings []musicBrainzRecording `json:"recordings"`
}

type musicBrainzRecording struct {
	ID               string               `json:"id"`
	Title            string               `json:"title"`
	FirstReleaseDate string               `json:"first-release-date"`
	ISRCs            []string             `json:"isrcs"`
	Releases         []musicBrainzRelease `json:"releases"`
}

type musicBrainzRelease struct {
	Title string `json:"title"`
	Date  string `json:"date"`
}

func (e *MusicBrainzEnricher) EnrichTracks(ctx context.Context, tracks []Track) ([]Track, error) {
	if e == nil {
		e = &MusicBrainzEnricher{}
	}
	out := make([]Track, len(tracks))
	copy(out, tracks)
	for i, track := range out {
		if track.Status != StatusMatched || strings.TrimSpace(track.Artist) == "" || strings.TrimSpace(track.Title) == "" {
			continue
		}
		recording, err := e.lookupRecording(ctx, track)
		if err != nil {
			return nil, err
		}
		if recording == nil {
			continue
		}
		out[i] = applyMusicBrainzRecording(track, *recording)
	}
	return out, nil
}

func (e *MusicBrainzEnricher) lookupRecording(ctx context.Context, track Track) (*musicBrainzRecording, error) {
	baseURL := strings.TrimSpace(e.BaseURL)
	if baseURL == "" {
		baseURL = defaultMusicBrainzBaseURL
	}
	query := url.Values{}
	query.Set("query", buildMusicBrainzQuery(track))
	query.Set("fmt", "json")
	query.Set("limit", "1")

	endpoint := strings.TrimRight(baseURL, "/") + "/recording/?" + query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if ua := strings.TrimSpace(e.UserAgent); ua != "" {
		req.Header.Set("User-Agent", ua)
	}

	client := e.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("musicbrainz lookup failed: %s", resp.Status)
	}

	var payload musicBrainzResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if len(payload.Recordings) == 0 {
		return nil, nil
	}
	return &payload.Recordings[0], nil
}

func buildMusicBrainzQuery(track Track) string {
	return fmt.Sprintf("recording:%q AND artist:%q", strings.TrimSpace(track.Title), strings.TrimSpace(track.Artist))
}

func applyMusicBrainzRecording(track Track, recording musicBrainzRecording) Track {
	track.MusicBrainzID = strings.TrimSpace(recording.ID)
	if len(recording.ISRCs) > 0 {
		track.ISRC = strings.TrimSpace(recording.ISRCs[0])
	}
	track.ReleaseDate = strings.TrimSpace(recording.FirstReleaseDate)
	if len(recording.Releases) > 0 {
		track.ReleaseTitle = strings.TrimSpace(recording.Releases[0].Title)
		if strings.TrimSpace(recording.Releases[0].Date) != "" {
			track.ReleaseDate = strings.TrimSpace(recording.Releases[0].Date)
		}
	}
	if track.MusicBrainzID != "" {
		track.SourceURL = "https://musicbrainz.org/recording/" + track.MusicBrainzID
	}
	return track
}
