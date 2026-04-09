package main

import (
	"fmt"
	"os"

	"github.com/coreycole/cctl/cmd"
	"github.com/coreycole/cctl/pkg/selfupdate"
)

// version is set by -ldflags "-X main.version=N"
var version string

func main() {
	// Self-update check before anything else
	if err := selfupdate.CheckAndRebuild(version); err != nil {
		fmt.Fprintf(os.Stderr, "selfupdate: %v\n", err)
	}

	cmd.Version = version
	cmd.Execute()
}
