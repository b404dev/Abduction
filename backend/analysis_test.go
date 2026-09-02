package backend

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
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

func TestAnalysisArchivesMarkdownReport(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("macOS path resolution is not exercised on Windows")
	}

	gitBinary, lookupError := exec.LookPath("git")
	if lookupError != nil {
		t.Fatal(lookupError)
	}

	temporaryRoot := t.TempDir()
	repositoryPath := filepath.Join(temporaryRoot, "repo")
	if makeError := os.MkdirAll(repositoryPath, 0o755); makeError != nil {
		t.Fatal(makeError)
	}

	gitInit := exec.Command(gitBinary, "init")
	gitInit.Dir = repositoryPath
	if outputBytes, commandError := gitInit.CombinedOutput(); commandError != nil {
		t.Fatalf("git init failed: %s", outputBytes)
	}

	homeDirectory := filepath.Join(temporaryRoot, "home")
	providerDirectory := filepath.Join(homeDirectory, ".local", "bin")
	if makeError := os.MkdirAll(providerDirectory, 0o755); makeError != nil {
		t.Fatal(makeError)
	}

	providerBinary := filepath.Join(providerDirectory, "codex")
	providerScript := "#!/bin/sh\nprintf '%s\n' '# Findings' 'bullet one' 'bullet two'\n"
	if writeError := os.WriteFile(providerBinary, []byte(providerScript), 0o755); writeError != nil {
		t.Fatal(writeError)
	}

	t.Setenv("HOME", homeDirectory)
	t.Setenv("PATH", "")
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(temporaryRoot, "config"))

	service := NewAnalysisService()
	jobID, startError := service.Start(context.Background(), repositoryPath, "codex", "review this")
	if startError != nil {
		t.Fatalf("expected provider lookup to use GUI fallback paths, got error: %v", startError)
	}
	if jobID == "" {
		t.Fatal("expected a job id")
	}

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		service.mutex.Lock()
		_, running := service.processes[jobID]
		service.mutex.Unlock()
		if !running {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}

	reportDirectory := filepath.Join(ConfigDirectory(), "analysis", filepath.Base(repositoryPath))
	matches, globError := filepath.Glob(filepath.Join(reportDirectory, "*.md"))
	if globError != nil {
		t.Fatal(globError)
	}
	if len(matches) != 1 {
		t.Fatalf("expected one analysis markdown report, got %d in %s", len(matches), reportDirectory)
	}
	reportBytes, readError := os.ReadFile(matches[0])
	if readError != nil {
		t.Fatalf("expected analysis report on disk, got error: %v", readError)
	}
	reportText := string(reportBytes)
	for _, expected := range []string{"# Analysis report", "## Prompt", "## Output", "review this", "bullet one", "bullet two"} {
		if !strings.Contains(reportText, expected) {
			t.Fatalf("expected analysis report to contain %q, got %q", expected, reportText)
		}
	}
}
