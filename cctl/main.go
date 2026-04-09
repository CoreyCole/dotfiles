package main

import (
	"fmt"
	"os"

	"github.com/coreycole/cctl/pkg/selfupdate"
)

// version is set by -ldflags "-X main.version=N"
var version string

func main() {
	// Self-update check before anything else
	if err := selfupdate.CheckAndRebuild(version); err != nil {
		fmt.Fprintf(os.Stderr, "selfupdate: %v\n", err)
		// Continue anyway
	}

	// Cobra commands will be wired in slice 9
	fmt.Println("cctl version", version)
}
