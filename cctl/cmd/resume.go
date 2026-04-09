package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/coreycole/cctl/pkg/convert"
	"github.com/coreycole/cctl/pkg/picker"
	"github.com/coreycole/cctl/pkg/session"
	"github.com/spf13/cobra"
)

var printFlag bool

var resumeCmd = &cobra.Command{
	Use:   "resume",
	Short: "Resume a pi or Claude session with fzf picker",
	RunE:  runResume,
}

func init() {
	resumeCmd.Flags().BoolVar(&printFlag, "print", false, "Print converted JSONL to stdout instead of launching pi")
	rootCmd.AddCommand(resumeCmd)
}

func runResume(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("getting cwd: %w", err)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("getting home dir: %w", err)
	}

	piDir := filepath.Join(home, ".pi", "agent", "sessions")
	claudeDir := filepath.Join(home, ".claude", "projects")

	sessions, err := session.DiscoverSessions(cwd, piDir, claudeDir)
	if err != nil {
		return fmt.Errorf("discovering sessions: %w", err)
	}

	if len(sessions) == 0 {
		fmt.Println("No sessions found for", cwd)
		return nil
	}

	// Format items for fzf
	items := make([]string, len(sessions))
	for i, s := range sessions {
		dateStr := s.Date.Format("2006-01-02 15:04")
		preview := s.Preview
		if preview == "" {
			preview = "(no preview)"
		}
		items[i] = fmt.Sprintf("[%s] %s  %s", s.Source, dateStr, preview)
	}

	selected, err := picker.Pick(items)
	if err != nil {
		return fmt.Errorf("fzf picker: %w", err)
	}

	// Find the selected session
	var selectedSession *session.SessionInfo
	for i, item := range items {
		if item == selected {
			selectedSession = &sessions[i]
			break
		}
	}

	if selectedSession == nil {
		return fmt.Errorf("selected session not found")
	}

	switch selectedSession.Source {
	case "pi":
		if printFlag {
			data, err := os.ReadFile(selectedSession.Path)
			if err != nil {
				return err
			}
			fmt.Print(string(data))
			return nil
		}
		return execPiFork(selectedSession.Path)

	case "claude":
		data, err := os.ReadFile(selectedSession.Path)
		if err != nil {
			return fmt.Errorf("reading claude session: %w", err)
		}

		converted, err := convert.ConvertSession(data)
		if err != nil {
			return fmt.Errorf("converting claude session: %w", err)
		}

		if printFlag {
			fmt.Print(string(converted))
			return nil
		}

		// Write to temp file
		sessionUUID := strings.TrimSuffix(filepath.Base(selectedSession.Path), ".jsonl")
		tmpPath := filepath.Join(os.TempDir(), fmt.Sprintf("cctl-claude-%s.jsonl", sessionUUID))
		if err := os.WriteFile(tmpPath, converted, 0644); err != nil {
			return fmt.Errorf("writing temp file: %w", err)
		}

		return execPiFork(tmpPath)
	}

	return fmt.Errorf("unknown session source: %s", selectedSession.Source)
}

// execPiFork execs `pi --fork <path>`, replacing the current process.
func execPiFork(sessionPath string) error {
	piPath, err := findPi()
	if err != nil {
		return err
	}
	return syscall.Exec(piPath, []string{"pi", "--fork", sessionPath}, os.Environ())
}

// findPi finds the pi binary in PATH.
func findPi() (string, error) {
	path, err := exec.LookPath("pi")
	if err != nil {
		// Try common locations
		for _, p := range []string{"/usr/local/bin/pi", "/opt/homebrew/bin/pi"} {
			if _, err := os.Stat(p); err == nil {
				return p, nil
			}
		}
		return "", fmt.Errorf("pi not found in PATH")
	}
	return path, nil
}
