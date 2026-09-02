package backend

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type reportMetadata struct {
	label string
	value string
}

type reportSection struct {
	title string
	body  string
}

// renderMarkdownReport builds a compact, readable Markdown report.
func renderMarkdownReport(title string, metadata []reportMetadata, sections []reportSection) string {
	var markdown strings.Builder
	markdown.WriteString("# ")
	markdown.WriteString(title)
	markdown.WriteString("\n\n")
	for _, item := range metadata {
		if item.value == "" {
			continue
		}
		markdown.WriteString("- ")
		markdown.WriteString(item.label)
		markdown.WriteString(": `")
		markdown.WriteString(item.value)
		markdown.WriteString("`\n")
	}
	if len(metadata) > 0 {
		markdown.WriteString("\n")
	}
	for _, section := range sections {
		markdown.WriteString("## ")
		markdown.WriteString(section.title)
		markdown.WriteString("\n\n")
		if section.body == "" {
			markdown.WriteString("_No output captured._\n\n")
			continue
		}
		markdown.WriteString("```text\n")
		markdown.WriteString(section.body)
		if !strings.HasSuffix(section.body, "\n") {
			markdown.WriteString("\n")
		}
		markdown.WriteString("```\n\n")
	}
	return markdown.String()
}

// archiveMarkdownReport writes one Markdown report to disk and returns its path.
func archiveMarkdownReport(reportDirectory string, reportPrefix string, markdown string) (string, error) {
	if makeError := os.MkdirAll(reportDirectory, 0o755); makeError != nil {
		return "", makeError
	}
	reportPath := filepath.Join(reportDirectory, fmt.Sprintf("%s-%s.md", reportPrefix, time.Now().Format("20060102-150405")))
	if writeError := os.WriteFile(reportPath, []byte(markdown), 0o600); writeError != nil {
		return "", writeError
	}
	return reportPath, nil
}
