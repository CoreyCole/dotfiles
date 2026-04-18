package config

import "testing"

func TestNormalizeUsernames(t *testing.T) {
	in := []string{"Alice", "bob,bob", " alice "}
	got := normalizeUsernames(in)
	if len(got) != 2 || got[0] != "alice" || got[1] != "bob" {
		t.Fatalf("unexpected usernames: %#v", got)
	}
}

func TestValidateDateRange(t *testing.T) {
	cfg := ExportConfig{Owner: "o", Repo: "r", StartDate: "2026-04-10", EndDate: "2026-04-01"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected range error")
	}
}
