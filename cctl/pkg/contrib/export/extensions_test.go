package export

import (
	"encoding/json"
	"testing"

	"github.com/coreycole/cctl/pkg/contrib/githubapi"
)

func TestAccumulateByExtensionMixed(t *testing.T) {
	files := []githubapi.PRFile{
		{Filename: "main.go", Additions: 10, Deletions: 2, Changes: 12},
		{Filename: "schema.sql", Additions: 4, Deletions: 1, Changes: 5},
		{Filename: "notes.md", Additions: 1, Deletions: 3, Changes: 4},
		{Filename: "handler.proto", Additions: 6, Deletions: 2, Changes: 8},
		{Filename: "index.ts", Additions: 7, Deletions: 1, Changes: 8},
		{Filename: "ui.tsx", Additions: 2, Deletions: 0, Changes: 2},
	}

	ext := AccumulateByExtension(files)
	if got := extStat(ext, ".go", 10, 2, 12, 1); !got {
		t.Fatalf("missing expected .go stats: %#v", ext[".go"])
	}
	if got := extStat(ext, ".sql", 4, 1, 5, 1); !got {
		t.Fatalf("missing expected .sql stats: %#v", ext[".sql"])
	}
	if got := extStat(ext, ".md", 1, 3, 4, 1); !got {
		t.Fatalf("missing expected .md stats: %#v", ext[".md"])
	}
	if got := extStat(ext, ".proto", 6, 2, 8, 1); !got {
		t.Fatalf("missing expected .proto stats: %#v", ext[".proto"])
	}
	if got := extStat(ext, ".ts", 7, 1, 8, 1); !got {
		t.Fatalf("missing expected .ts stats: %#v", ext[".ts"])
	}
	if got := extStat(ext, ".tsx", 2, 0, 2, 1); !got {
		t.Fatalf("missing expected .tsx stats: %#v", ext[".tsx"])
	}
}

func TestApplyKnownAndEncodeOther(t *testing.T) {
	files := []githubapi.PRFile{
		{Filename: "main.go", Additions: 4, Deletions: 1, Changes: 5},
		{Filename: "legacy.legacy", Additions: 7, Deletions: 3, Changes: 10},
		{Filename: "note.md", Additions: 1, Deletions: 0, Changes: 1},
		{Filename: "other", Additions: 2, Deletions: 2, Changes: 4},
	}

	ext := AccumulateByExtension(files)
	row := Row{}
	ApplyKnownExtensionColumns(&row, ext)
	if row.GoFilesTouched != 1 || row.GoLinesAdded != 4 || row.GoLinesRemoved != 1 {
		t.Fatalf("got go cols: %#v", row)
	}
	if row.MDFilesTouched != 1 || row.MDLinesAdded != 1 || row.MDLinesRemoved != 0 {
		t.Fatalf("got md cols: %#v", row)
	}

	other, err := EncodeOtherExtensionStats(ext, []string{".go", ".proto", ".sql", ".md", ".ts", ".tsx"})
	if err != nil {
		t.Fatalf("EncodeOtherExtensionStats: %v", err)
	}

	var got map[string]githubapi.ExtensionStat
	if err := json.Unmarshal([]byte(other), &got); err != nil {
		t.Fatalf("json unmarshal: %v", err)
	}
	if _, ok := got["_no_ext"]; !ok {
		t.Fatalf("expected _no_ext in other stats: %#v", got)
	}
	if _, ok := got[".legacy"]; !ok {
		t.Fatalf("expected .legacy in other stats: %#v", got)
	}
}

func TestUppercaseExtensionNormalizedForKnown(t *testing.T) {
	ext := AccumulateByExtension([]githubapi.PRFile{{Filename: "DOC.MD", Additions: 2, Deletions: 1, Changes: 3}})
	if stat, ok := ext[".md"]; !ok || stat.Added != 2 || stat.Removed != 1 || stat.Changed != 3 || stat.FilesTouched != 1 {
		t.Fatalf("expected normalized .md stats, got %#v", ext)
	}
}

func extStat(m map[string]githubapi.ExtensionStat, ext string, added, removed, changed, files int) bool {
	s, ok := m[ext]
	if !ok {
		return false
	}
	return s.Added == added && s.Removed == removed && s.Changed == changed && s.FilesTouched == files
}
