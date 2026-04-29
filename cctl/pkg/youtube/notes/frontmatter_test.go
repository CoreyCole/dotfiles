package notes

import (
	"path/filepath"
	"testing"
)

func TestParseFrontmatterIgnoresNestedTrackFields(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "notes.md")
	mustWriteFile(t, path, `---
title: "This groove will fix your mood"
url: https://youtu.be/PGiXImrEjAY
video_id: PGiXImrEjAY
channel: Clara Giuliani
published_at: 2026-04-22
tracks:
  - start: "00:00"
    artist: "Folamour"
    title: "These Are Just Places To Me Now"
---
`)

	meta, err := parseFrontmatter(path)
	if err != nil {
		t.Fatalf("parseFrontmatter returned error: %v", err)
	}
	if meta.Title != "This groove will fix your mood" {
		t.Fatalf("expected top-level title to win, got %q", meta.Title)
	}
	if meta.Channel != "Clara Giuliani" {
		t.Fatalf("expected top-level channel to be preserved, got %q", meta.Channel)
	}
}
