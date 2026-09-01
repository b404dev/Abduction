package backend

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

// TestAnalysisStartFindsProviderInMacGUIPaths guards the macOS GUI PATH gap.
func TestAnalysisStartFindsProviderInMacGUIPaths(testingContext *testing.T) {
	if runtime.GOOS == "windows" {
		testingContext.Skip("macOS path resolution is not exercised on Windows")
	}

	gitBinary, lookupError := exec.LookPath("git")
	if lookupError != nil {
		testingContext.Fatal(lookupError)
	}

	temporaryRoot := testingContext.TempDir()
	repositoryPath := filepath.Join(temporaryRoot, "repo")
	if makeError := os.MkdirAll(repositoryPath, 0o755); makeError != nil {
		testingContext.Fatal(makeError)
	}

	gitInit := exec.Command(gitBinary, "init")
	gitInit.Dir = repositoryPath
	if outputBytes, commandError := gitInit.CombinedOutput(); commandError != nil {
		testingContext.Fatalf("git init failed: %s", outputBytes)
	}

	homeDirectory := filepath.Join(temporaryRoot, "home")
	providerDirectory := filepath.Join(homeDirectory, ".local", "bin")
	if makeError := os.MkdirAll(providerDirectory, 0o755); makeError != nil {
		testingContext.Fatal(makeError)
	}

	providerBinary := filepath.Join(providerDirectory, "codex")
	providerScript := "#!/bin/sh\necho codex-ready\n"
	if writeError := os.WriteFile(providerBinary, []byte(providerScript), 0o755); writeError != nil {
		testingContext.Fatal(writeError)
	}

	testingContext.Setenv("HOME", homeDirectory)
	testingContext.Setenv("PATH", "")

	service := NewAnalysisService()
	jobID, startError := service.Start(context.Background(), repositoryPath, "codex", "review this")
	if startError != nil {
		testingContext.Fatalf("expected provider lookup to use GUI fallback paths, got error: %v", startError)
	}
	if jobID == "" {
		testingContext.Fatal("expected a job id")
	}
}
