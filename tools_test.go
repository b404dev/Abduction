package main

import "testing"

func TestDetectedToolsAlwaysHaveLanguageLists(t *testing.T) {
	for _, tool := range DetectTools() {
		if tool.Languages == nil {
			t.Fatalf("tool %s has a nil languages list", tool.Name)
		}
	}
}
