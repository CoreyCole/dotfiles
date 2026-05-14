package flights

import "testing"

func TestValidateAppliesDefaults(t *testing.T) {
	cfg, err := (Config{}).Validate()
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if cfg.GogBin != "gog" {
		t.Fatalf("GogBin=%q", cfg.GogBin)
	}
	if cfg.Account != DefaultAccount() {
		t.Fatalf("Account=%q", cfg.Account)
	}
	if cfg.Query != DefaultQuery() {
		t.Fatalf("Query=%q", cfg.Query)
	}
	if cfg.RootDir != DefaultRootDir() {
		t.Fatalf("RootDir=%q", cfg.RootDir)
	}
	if cfg.MaxResults != 10 {
		t.Fatalf("MaxResults=%d", cfg.MaxResults)
	}
}

func TestValidatePreservesExplicitValues(t *testing.T) {
	cfg, err := (Config{
		GogBin:     "/usr/sbin/gog",
		Account:    "other@example.com",
		Query:      "from:going.com newer_than:7d",
		MaxResults: 3,
		RootDir:    "/tmp/flights",
		DryRun:     true,
	}).Validate()
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if cfg.GogBin != "/usr/sbin/gog" {
		t.Fatalf("GogBin=%q", cfg.GogBin)
	}
	if cfg.Account != "other@example.com" {
		t.Fatalf("Account=%q", cfg.Account)
	}
	if cfg.Query != "from:going.com newer_than:7d" {
		t.Fatalf("Query=%q", cfg.Query)
	}
	if cfg.MaxResults != 3 {
		t.Fatalf("MaxResults=%d", cfg.MaxResults)
	}
	if cfg.RootDir != "/tmp/flights" {
		t.Fatalf("RootDir=%q", cfg.RootDir)
	}
	if !cfg.DryRun {
		t.Fatal("DryRun=false")
	}
}

func TestValidateRejectsTooManyResults(t *testing.T) {
	_, err := (Config{MaxResults: 101}).Validate()
	if err == nil {
		t.Fatal("expected max-results validation error")
	}
}
