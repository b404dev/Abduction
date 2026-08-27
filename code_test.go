package main

import (
	"strings"
	"testing"
)

func TestMarkdownCodeBlocksIncludeCopyControl(t *testing.T) {
	document := NewCodeService().renderMarkdown("README.md", "README.md", "```sh\ncurl -fsSL https://example.test/install.sh | bash\n```\n")
	if !strings.Contains(document.HTML, `data-markdown-copy="true"`) {
		t.Fatal("rendered Markdown code block does not contain a copy control")
	}
	if !strings.Contains(document.HTML, "curl -fsSL") {
		t.Fatal("rendered Markdown code block lost its command text")
	}
}
