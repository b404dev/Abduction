package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDetectedToolsAlwaysHaveLanguageLists(t *testing.T) {
	for _, tool := range DetectTools() {
		if tool.Languages == nil {
			t.Fatalf("tool %s has a nil languages list", tool.Name)
		}
	}
}

func TestToolDetectionCannotBlockStartup(t *testing.T) {
	toolPath := filepath.Join(t.TempDir(), "slow-tool")
	if writeError := os.WriteFile(toolPath, []byte("#!/bin/sh\nexec sleep 5\n"), 0o755); writeError != nil {
		t.Fatal(writeError)
	}
	tool := Tool{Name: toolPath}
	startedAt := time.Now()
	detectToolWithTimeout(&tool, 50*time.Millisecond)
	if elapsed := time.Since(startedAt); elapsed > time.Second {
		t.Fatalf("tool probe ignored its timeout: %s", elapsed)
	}
	if !tool.Available {
		t.Fatal("resolved tool should remain marked available when its version probe times out")
	}
}
