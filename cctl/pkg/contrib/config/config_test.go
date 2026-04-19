package config

import "testing"

func TestValidateAppliesDefaults(t *testing.T) {
	cfg := ExportConfig{
		StartDate: "2026-04-01",
		EndDate:   "2026-04-30",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if cfg.RepoDir != "." {
		t.Fatalf("RepoDir = %q, want .", cfg.RepoDir)
	}
	if cfg.Branch != "main" {
		t.Fatalf("Branch = %q, want main", cfg.Branch)
	}
	if cfg.Output != "contributions.csv" {
		t.Fatalf("Output = %q, want contributions.csv", cfg.Output)
	}
}

func TestValidateRejectsInvalidRange(t *testing.T) {
	cfg := ExportConfig{
		RepoDir:   ".",
		Branch:    "main",
		StartDate: "2026-04-10",
		EndDate:   "2026-04-01",
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected range error")
	}
}

func TestValidateRejectsBadDate(t *testing.T) {
	cfg := ExportConfig{
		RepoDir:   ".",
		Branch:    "main",
		StartDate: "2026-04-xx",
		EndDate:   "2026-04-01",
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected invalid date error")
	}
}
