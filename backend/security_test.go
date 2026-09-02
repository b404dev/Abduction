package backend

import (
	"os"
	"path/filepath"
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

func containsEnv(environment []string, target string) bool {
	for _, entry := range environment {
		if entry == target {
			return true
		}
	}
	return false
}
