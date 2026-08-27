package main

import (
	"bytes"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/alecthomas/chroma/v2"
	"github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/lexers"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

const maximumReadableFileSize = 16 * 1024 * 1024

// CodeService renders repository documents without exposing raw host access to the UI.
type CodeService struct {
	markdown goldmark.Markdown
}

// NewCodeService configures GitHub-flavoured Markdown once for reuse.
func NewCodeService() *CodeService {
	markdownRenderer := goldmark.New(goldmark.WithExtensions(extension.GFM))
	return &CodeService{markdown: markdownRenderer}
}

// ReadOverview finds and renders the first conventional repository README.
func (service *CodeService) ReadOverview(repositoryPath string, themeName string) (Document, error) {
	readmeNames := []string{"README.md", "readme.md", "README.markdown", "README", "README.txt"}
	for _, readmeName := range readmeNames {
		if _, statError := os.Stat(filepath.Join(repositoryPath, readmeName)); statError == nil {
			return service.ReadFile(repositoryPath, readmeName, themeName)
		}
	}
	emptySource := "# No README yet\n\nChoose a file from the tree to begin exploring this repository."
	return service.renderMarkdown("Overview", "", emptySource), nil
}

// ReadFile validates, reads, and renders one repository file.
func (service *CodeService) ReadFile(repositoryPath string, relativePath string, themeName string) (Document, error) {
	filePath, pathError := SafeRepositoryPath(repositoryPath, relativePath)
	if pathError != nil {
		return Document{}, pathError
	}
	fileInfo, statError := os.Stat(filePath)
	if statError != nil {
		return Document{}, statError
	}
	if fileInfo.IsDir() {
		return Document{}, errors.New("cannot read a directory as a file")
	}
	if fileInfo.Size() > maximumReadableFileSize {
		return Document{Path: relativePath, Name: filepath.Base(relativePath), Size: fileInfo.Size(), Binary: true}, nil
	}
	sourceBytes, readError := os.ReadFile(filePath)
	if readError != nil {
		return Document{}, readError
	}
	if !utf8.Valid(sourceBytes) || bytes.IndexByte(sourceBytes, 0) >= 0 {
		return Document{Path: relativePath, Name: filepath.Base(relativePath), Size: fileInfo.Size(), Binary: true}, nil
	}
	source := string(sourceBytes)
	if IsMarkdown(relativePath) {
		document := service.renderMarkdown(filepath.Base(relativePath), relativePath, source)
		document.Size = fileInfo.Size()
		return document, nil
	}
	return RenderCode(relativePath, source, themeName, fileInfo.Size())
}

// renderMarkdown converts trusted source text into sanitised document HTML.
func (service *CodeService) renderMarkdown(name string, relativePath string, source string) Document {
	var rendered bytes.Buffer
	convertError := service.markdown.Convert([]byte(source), &rendered)
	if convertError != nil {
		rendered.Reset()
		rendered.WriteString("<p>Markdown rendering failed.</p>")
	}
	safeHTML := bluemonday.UGCPolicy().SanitizeBytes(rendered.Bytes())
	markdownHTML := strings.ReplaceAll(string(safeHTML), "<pre>", `<div class="markdown-code-frame"><button type="button" class="markdown-copy" data-markdown-copy="true" aria-label="Copy code block">Copy</button><pre>`)
	markdownHTML = strings.ReplaceAll(markdownHTML, "</pre>", "</pre></div>")
	return Document{Path: relativePath, Name: name, Language: "markdown", HTML: markdownHTML, Source: source, Lines: CountLines(source), Markdown: true}
}

// RenderCode uses Chroma to produce class-based, line-numbered HTML.
func RenderCode(relativePath string, source string, themeName string, size int64) (Document, error) {
	lexer := lexers.Match(relativePath)
	if lexer == nil {
		lexer = lexers.Fallback
	}
	lexer = chroma.Coalesce(lexer)
	iterator, tokeniseError := lexer.Tokenise(nil, source)
	if tokeniseError != nil {
		return Document{}, tokeniseError
	}
	style := ResolveCodeStyle(themeName)
	formatter := html.New(
		html.WithLineNumbers(true),
		html.WithLinkableLineNumbers(true, "line-"), html.TabWidth(4),
		html.WrapLongLines(false),
	)
	var rendered bytes.Buffer
	if formatError := formatter.Format(&rendered, style, iterator); formatError != nil {
		return Document{}, formatError
	}
	return Document{
		Path: relativePath, Name: filepath.Base(relativePath), Language: lexer.Config().Name,
		HTML: rendered.String(), Source: source, Size: size, Lines: CountLines(source),
	}, nil
}

// ResolveCodeStyle maps application themes onto bundled Chroma palettes.
func ResolveCodeStyle(themeName string) *chroma.Style {
	styleNames := map[string]string{
		"reaper-dark": "catppuccin-mocha", "reaper-blood": "dracula", "reaper-void": "catppuccin-mocha",
		"tokyo-night": "tokyonight-night", "tokyo-neon": "tokyonight-night", "tokyo-dusk": "dracula",
		"matte-black": "monokai", "matte-ember": "monokai", "matte-ice": "github-dark",
		"hackerman": "doom-one2", "hackerman-amber": "monokai", "hackerman-ghost": "doom-one2",
		"catppuccin-mocha": "catppuccin-mocha", "catppuccin-macchiato": "catppuccin-macchiato", "catppuccin-frappe": "catppuccin-frappe", "catppuccin-latte": "catppuccin-latte",
		"everforest": "evergarden", "gruvbox": "gruvbox", "kanagawa": "github-dark", "nord": "nord", "rose-pine": "rose-pine",
		"lost-mary": "monokai",
	}
	style := styles.Get(styleNames[themeName])
	if style == nil {
		style = styles.Get("catppuccin-mocha")
	}
	if style == nil {
		style = styles.Fallback
	}
	return style
}

// IsMarkdown reports whether a file should use the rich document renderer.
func IsMarkdown(relativePath string) bool {
	extensionName := strings.ToLower(filepath.Ext(relativePath))
	return extensionName == ".md" || extensionName == ".markdown"
}

// CountLines reports a useful one-based line count, including empty files.
func CountLines(source string) int {
	if source == "" {
		return 0
	}
	return strings.Count(source, "\n") + 1
}

// DetectRepositoryLanguage estimates the primary language from file extensions.
func DetectRepositoryLanguage(repositoryPath string) string {
	languageCounts := make(map[string]int)
	_ = filepath.WalkDir(repositoryPath, func(currentPath string, directoryEntry fs.DirEntry, walkError error) error {
		if walkError != nil {
			return nil
		}
		if directoryEntry.IsDir() && IsIgnoredDirectory(directoryEntry.Name()) {
			return filepath.SkipDir
		}
		if !directoryEntry.IsDir() {
			languageName := LanguageForPath(currentPath)
			if languageName != "Text" {
				languageCounts[languageName]++
			}
		}
		return nil
	})
	type languageTotal struct {
		name  string
		count int
	}
	languageTotals := make([]languageTotal, 0, len(languageCounts))
	for languageName, languageCount := range languageCounts {
		languageTotals = append(languageTotals, languageTotal{name: languageName, count: languageCount})
	}
	sort.Slice(languageTotals, func(leftIndex int, rightIndex int) bool {
		return languageTotals[leftIndex].count > languageTotals[rightIndex].count
	})
	if len(languageTotals) == 0 {
		return "Text"
	}
	return languageTotals[0].name
}

// IsIgnoredDirectory excludes metadata and dependency trees from language detection.
func IsIgnoredDirectory(directoryName string) bool {
	ignoredDirectories := map[string]bool{".git": true, "node_modules": true, "vendor": true, ".venv": true, "dist": true}
	return ignoredDirectories[directoryName]
}

// LanguageForPath returns a friendly language name from a deterministic filename match.
func LanguageForPath(relativePath string) string {
	lexer := lexers.Match(relativePath)
	if lexer == nil {
		return "Text"
	}
	return lexer.Config().Name
}
