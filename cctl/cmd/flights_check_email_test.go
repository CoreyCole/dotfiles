package cmd

import (
	"bytes"
	"strings"
	"testing"
)

func TestFlightsCheckEmailHelpShowsFlags(t *testing.T) {
	buf := new(bytes.Buffer)
	rootCmd.SetOut(buf)
	rootCmd.SetErr(buf)
	rootCmd.SetArgs([]string{"flights", "check-email", "--help"})
	t.Cleanup(func() {
		rootCmd.SetOut(nil)
		rootCmd.SetErr(nil)
		rootCmd.SetArgs(nil)
	})

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	out := buf.String()
	for _, want := range []string{"--query", "--max-results", "--dry-run", "--root", "--account", "--gog-bin"} {
		if !strings.Contains(out, want) {
			t.Fatalf("help missing %s:\n%s", want, out)
		}
	}
}
