package tracklist

import "testing"

func TestParseDescriptionExtractsStructuredTracks(t *testing.T) {
	description := `Groove Session was created to turn music into an experience.

Tracklist:

00:00 Folamour – These Are Just Places To Me Now (Original Mix)
05:00 Gaol – Speechless (Original Mix)
34:00 We Gotta Boogie
48:30 David Penn – Stupidisco (Remix)

If you vibe with the sound, like, comment and share.`

	parsed := ParseDescription(description)
	if !parsed.HasTracklist {
		t.Fatal("expected tracklist to be detected")
	}
	if parsed.Category != "dj_set" {
		t.Fatalf("expected category dj_set, got %q", parsed.Category)
	}
	if parsed.TrackCount != 4 {
		t.Fatalf("expected 4 tracks, got %d", parsed.TrackCount)
	}

	first := parsed.Tracks[0]
	if first.Start != "00:00" || first.Artist != "Folamour" || first.Title != "These Are Just Places To Me Now" || first.Mix != "Original Mix" || first.Status != StatusMatched {
		t.Fatalf("unexpected first track: %+v", first)
	}

	third := parsed.Tracks[2]
	if third.Status != StatusPartial {
		t.Fatalf("expected partial status for ambiguous line, got %+v", third)
	}
	if third.Artist != "" || third.Title != "We Gotta Boogie" {
		t.Fatalf("expected title-only partial track, got %+v", third)
	}

	fourth := parsed.Tracks[3]
	if fourth.Mix != "Remix" {
		t.Fatalf("expected remix suffix to be extracted, got %+v", fourth)
	}
}

func TestParseDescriptionReturnsEmptyWithoutTracklistSection(t *testing.T) {
	parsed := ParseDescription("no timestamps here\njust a normal description")
	if parsed.HasTracklist {
		t.Fatal("expected no tracklist")
	}
	if parsed.TrackCount != 0 || len(parsed.Tracks) != 0 {
		t.Fatalf("expected empty tracklist, got %+v", parsed)
	}
}

func TestParseLineSupportsHyphenSeparatorsAndTrailingMixSuffix(t *testing.T) {
	track, ok := ParseLine("29:00 Block & Crown - Love Explosion")
	if !ok {
		t.Fatal("expected line to parse")
	}
	if track.Artist != "Block & Crown" || track.Title != "Love Explosion" || track.Status != StatusMatched {
		t.Fatalf("unexpected parsed track: %+v", track)
	}

	track, ok = ParseLine("05:00 Gaol – Speechless (Original Mix)")
	if !ok {
		t.Fatal("expected en-dash line to parse")
	}
	if track.Mix != "Original Mix" {
		t.Fatalf("expected mix extraction, got %+v", track)
	}
}
