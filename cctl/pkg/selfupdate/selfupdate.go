package selfupdate

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// CheckAndRebuild checks if the compiled version matches the source VERSION file.
// If the source version is newer, it rebuilds the binary and re-execs.
func CheckAndRebuild(compiledVersion string) error {
	srcDir, err := sourceDir()
	if err != nil {
		return nil // Can't determine source dir, continue normally
	}

	sourceVer, err := readVersionFile(srcDir)
	if err != nil {
		return nil // No VERSION file, continue normally
	}

	compiledVer, err := strconv.Atoi(compiledVersion)
	if err != nil {
		compiledVer = 0
	}

	if sourceVer <= compiledVer {
		return nil // Up to date
	}

	// Rebuild
	fmt.Fprintf(os.Stderr, "cctl: auto-rebuilding (v%d → v%d)...\n", compiledVer, sourceVer)

	ldflags := fmt.Sprintf("-X main.version=%d", sourceVer)
	outputPath := filepath.Join(srcDir, "bin", "cctl")

	// Ensure bin/ directory exists
	os.MkdirAll(filepath.Join(srcDir, "bin"), 0755)

	cmd := exec.Command("go", "build", "-ldflags", ldflags, "-o", outputPath, ".")
	cmd.Dir = srcDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("rebuild failed: %w", err)
	}

	// Re-exec the new binary with the same args
	return syscall.Exec(outputPath, os.Args, os.Environ())
}

// sourceDir resolves the source directory from the binary location.
// Binary is at <srcDir>/bin/cctl, so we go up one level from the binary's dir.
func sourceDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}

	// Follow symlinks
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return "", err
	}

	// Binary is at <srcDir>/bin/cctl → go up two levels
	binDir := filepath.Dir(exe)
	srcDir := filepath.Dir(binDir)

	// Verify this looks like a source dir (has go.mod)
	if _, err := os.Stat(filepath.Join(srcDir, "go.mod")); err != nil {
		return "", fmt.Errorf("no go.mod found at %s", srcDir)
	}

	return srcDir, nil
}

// readVersionFile reads and parses the VERSION file as an integer.
func readVersionFile(dir string) (int, error) {
	data, err := os.ReadFile(filepath.Join(dir, "VERSION"))
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(strings.TrimSpace(string(data)))
}
