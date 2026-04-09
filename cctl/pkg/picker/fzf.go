package picker

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Pick presents items via fzf and returns the selected item.
func Pick(items []string) (string, error) {
	fzfPath, err := exec.LookPath("fzf")
	if err != nil {
		return "", fmt.Errorf("fzf not found in PATH: %w", err)
	}

	cmd := exec.Command(fzfPath, "--ansi", "--reverse", "--no-sort")
	cmd.Stdin = strings.NewReader(strings.Join(items, "\n"))
	cmd.Stderr = os.Stderr

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 130 {
				// User cancelled with Ctrl-C/Esc
				os.Exit(0)
			}
		}
		return "", err
	}

	return strings.TrimSpace(string(output)), nil
}
