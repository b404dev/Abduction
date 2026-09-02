package backend

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScannerDetectionUsesExecutablePathFallbacks(t *testing.T) {
	home := t.TempDir()
	localBin := filepath.Join(home, ".local", "bin")
	if err := os.MkdirAll(localBin, 0o755); err != nil {
		t.Fatal(err)
	}
	scannerPath := filepath.Join(localBin, "gitleaks")
	if err := os.WriteFile(scannerPath, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	t.Setenv("HOME", home)
	t.Setenv("PATH", "")

	service := NewSecurityService()
	scanners := service.Scanners()
	for _, scanner := range scanners {
		if scanner.Name == "gitleaks" && !scanner.Available {
			t.Fatal("expected gitleaks to be detected from ~/.local/bin when PATH is empty")
		}
	}
}

func TestResolveScannerUsesExecutablePathFallbacks(t *testing.T) {
	home := t.TempDir()
	localBin := filepath.Join(home, ".local", "bin")
	if err := os.MkdirAll(localBin, 0o755); err != nil {
		t.Fatal(err)
	}
	scannerPath := filepath.Join(localBin, "gitleaks")
	if err := os.WriteFile(scannerPath, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	t.Setenv("HOME", home)
	t.Setenv("PATH", "")

	_, resolvedPath, err := resolveScanner("gitleaks")
	if err != nil {
		t.Fatalf("expected gitleaks to resolve from ~/.local/bin, got error: %v", err)
	}
	if resolvedPath != scannerPath {
		t.Fatalf("expected resolved path %q, got %q", scannerPath, resolvedPath)
	}
}

func TestTrivyUsesCleanDockerConfig(t *testing.T) {
	xdgConfigHome := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", xdgConfigHome)

	dockerConfigDirectory, err := trivyDockerConfigDirectory()
	if err != nil {
		t.Fatalf("expected trivy docker config directory, got error: %v", err)
	}
	if got, want := dockerConfigDirectory, filepath.Join(xdgConfigHome, "reaper", "trivy-docker"); got != want {
		t.Fatalf("expected docker config directory %q, got %q", want, got)
	}
	configBytes, readError := os.ReadFile(filepath.Join(dockerConfigDirectory, "config.json"))
	if readError != nil {
		t.Fatalf("expected trivy config.json, got error: %v", readError)
	}
	if got := string(configBytes); got != "{}\n" {
		t.Fatalf("expected empty docker config, got %q", got)
	}
	if got := trivyEnvironment(dockerConfigDirectory); !containsEnv(got, "DOCKER_CONFIG="+dockerConfigDirectory) {
		t.Fatalf("expected DOCKER_CONFIG in environment, got %v", got)
	}
}

func TestArchiveScanWritesMarkdownReport(t *testing.T) {
	repositoryPath := filepath.Join(t.TempDir(), "scan-target")
	if err := os.MkdirAll(repositoryPath, 0o755); err != nil {
		t.Fatal(err)
	}

	reportPath, err := archiveScan(repositoryPath, "gitleaks", []string{"first line", "second line"})
	if err != nil {
		t.Fatalf("expected markdown scan report, got error: %v", err)
	}
	if filepath.Ext(reportPath) != ".md" {
		t.Fatalf("expected markdown report path, got %q", reportPath)
	}
	reportBytes, readError := os.ReadFile(reportPath)
	if readError != nil {
		t.Fatalf("expected scan report on disk, got error: %v", readError)
	}
	reportText := string(reportBytes)
	for _, expected := range []string{"# Security scan report", "## Scan output", "```text", "first line", "second line"} {
		if !strings.Contains(reportText, expected) {
			t.Fatalf("expected scan report to contain %q, got %q", expected, reportText)
		}
	}
}

func containsEnv(environment []string, target string) bool {
	for _, entry := range environment {
		if entry == target {
			return true
		}
	}
	return false
}
