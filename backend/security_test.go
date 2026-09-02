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
