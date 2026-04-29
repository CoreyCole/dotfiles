package tracklist

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestMusicBrainzEnricherPopulatesMatchedTracks(t *testing.T) {
	var gotQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query().Get("query")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
		  "recordings": [
		    {
		      "id": "9120556a-ffd0-4001-84e2-d5918cf94fa9",
		      "score": 100,
		      "title": "These Are Just Places to Me Now",
		      "first-release-date": "2019-05-17",
		      "isrcs": ["GBKQU1905220"],
		      "releases": [{"title": "Defected Ibiza 2019", "date": "2019-05-17"}]
		    }
		  ]
		}`))
	}))
	defer server.Close()

	enricher := &MusicBrainzEnricher{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
		UserAgent:  "test-agent",
	}

	tracks := []Track{{Start: "00:00", Artist: "Folamour", Title: "These Are Just Places To Me Now", Status: StatusMatched}}
	out, err := enricher.EnrichTracks(context.Background(), tracks)
	if err != nil {
		t.Fatalf("EnrichTracks returned error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 track, got %d", len(out))
	}
	if !strings.Contains(gotQuery, "recording:") || !strings.Contains(gotQuery, "artist:") {
		t.Fatalf("expected recording+artist query, got %q", gotQuery)
	}
	if out[0].MusicBrainzID != "9120556a-ffd0-4001-84e2-d5918cf94fa9" {
		t.Fatalf("expected MusicBrainz ID to be populated, got %+v", out[0])
	}
	if out[0].ISRC != "GBKQU1905220" || out[0].ReleaseTitle != "Defected Ibiza 2019" || out[0].ReleaseDate != "2019-05-17" {
		t.Fatalf("expected release metadata to be populated, got %+v", out[0])
	}
	if out[0].SourceURL != "https://musicbrainz.org/recording/9120556a-ffd0-4001-84e2-d5918cf94fa9" {
		t.Fatalf("expected source URL, got %+v", out[0])
	}
}

func TestMusicBrainzEnricherSkipsPartialTracks(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	enricher := &MusicBrainzEnricher{BaseURL: server.URL, HTTPClient: server.Client(), UserAgent: "test-agent"}
	tracks := []Track{{Start: "34:00", Title: "We Gotta Boogie", Status: StatusPartial}}
	out, err := enricher.EnrichTracks(context.Background(), tracks)
	if err != nil {
		t.Fatalf("EnrichTracks returned error: %v", err)
	}
	if called {
		t.Fatal("expected partial track to skip remote lookup")
	}
	if out[0].MusicBrainzID != "" {
		t.Fatalf("expected partial track to remain untouched, got %+v", out[0])
	}
}

func TestBuildMusicBrainzQueryEscapesArtistAndTitle(t *testing.T) {
	query := buildMusicBrainzQuery(Track{Artist: "Block & Crown", Title: "Love Explosion"})
	decoded, err := url.QueryUnescape(url.QueryEscape(query))
	if err != nil {
		t.Fatalf("unexpected error decoding query: %v", err)
	}
	if !strings.Contains(decoded, `artist:"Block & Crown"`) || !strings.Contains(decoded, `recording:"Love Explosion"`) {
		t.Fatalf("unexpected query: %q", decoded)
	}
}
