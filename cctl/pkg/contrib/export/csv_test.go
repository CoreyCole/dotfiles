package export

import (
	"encoding/csv"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

func TestWriteCSV(t *testing.T) {
	rows := []Row{sampleRow()}

	var got strings.Builder
	if err := WriteCSV(&got, rows); err != nil {
		t.Fatalf("WriteCSV: %v", err)
	}

	want, err := os.ReadFile("testdata/export.golden.csv")
	if err != nil {
		t.Fatalf("reading golden: %v", err)
	}
	if got.String() != string(want) {
		t.Fatalf("output mismatch:\n\nGot:\n%s\nWant:\n%s", got.String(), string(want))
	}
}

func TestHeader(t *testing.T) {
	header := Header()
	if len(header) != 41 {
		t.Fatalf("got %d header columns, want 41", len(header))
	}
	if header[0] != "repo" || header[len(header)-1] != "other_lines_by_extension_json" {
		t.Fatalf("unexpected header boundaries: %q ... %q", header[0], header[len(header)-1])
	}
}

func TestRecord(t *testing.T) {
	r := Record(sampleRow())
	if len(r) != 41 {
		t.Fatalf("got %d fields, want 41", len(r))
	}
	if !strings.HasSuffix(r[1], "Z") {
		t.Fatalf("merged_at is not UTC RFC3339: %q", r[1])
	}
	if _, err := time.Parse(time.RFC3339, r[1]); err != nil {
		t.Fatalf("merged_at not RFC3339: %v", err)
	}
	if r[14] != "a;z" {
		t.Fatalf("labels not deterministic: %q", r[14])
	}
	if !json.Valid([]byte(r[40])) {
		t.Fatalf("other_lines_by_extension_json invalid JSON: %q", r[40])
	}
}

func TestCSVReaderCanParseOutput(t *testing.T) {
	var buf strings.Builder
	if err := WriteCSV(&buf, []Row{sampleRow()}); err != nil {
		t.Fatalf("WriteCSV: %v", err)
	}

	r := csv.NewReader(strings.NewReader(buf.String()))
	records, err := r.ReadAll()
	if err != nil {
		t.Fatalf("read all: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("got %d records, want 2", len(records))
	}
	if len(records[0]) != 41 || len(records[1]) != 41 {
		t.Fatalf("got %d/%d fields, want 41", len(records[0]), len(records[1]))
	}
}

func sampleRow() Row {
	return Row{
		Repo:                      "o/r",
		MergedAt:                  time.Date(2026, 1, 2, 10, 0, 0, 0, time.UTC),
		PRCreatedAt:               time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC),
		CycleTimeHours:            24,
		CommitSHA:                 "c1",
		CommitURL:                 "https://github.com/o/r/commit/c1",
		GitHubUsername:            "alice",
		GitHubName:                "Alice",
		PRNumber:                  42,
		PRTitle:                   "Add feature",
		PRURL:                     "https://github.com/o/r/pull/42",
		LinesAdded:                10,
		LinesRemoved:              3,
		FilesTouched:              2,
		Labels:                    []string{"a", "z"},
		AuthorAssociation:         "OWNER",
		MergedBy:                  "bob",
		ReviewCount:               1,
		CommentCount:              2,
		BaseBranch:                "main",
		HeadBranch:                "feature/test",
		IsDraft:                   false,
		GoLinesAdded:              1,
		GoLinesRemoved:            0,
		GoFilesTouched:            1,
		ProtoLinesAdded:           2,
		ProtoLinesRemoved:         1,
		ProtoFilesTouched:         1,
		OtherLinesByExtensionJSON: `{".txt":{"added":7,"removed":1,"changed":8,"files_touched":1}}`,
	}
}
