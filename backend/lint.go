package backend

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type linterSpec struct {
	name      string
	binary    string
	languages []string
	install   string
	commands  []InstallCommand
	arguments func(string) []string
}

var linterRegistry = []linterSpec{
	{name: "golangci-lint", languages: []string{"Go"}, install: "Comprehensive Go linter", commands: PackageCommands("brew install golangci-lint", "go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest", "sudo pacman -S golangci-lint"), arguments: func(path string) []string {
		return []string{"run", "--out-format=line-number", "./" + filepath.ToSlash(filepath.Dir(path)) + "/..."}
	}},
	{name: "go", languages: []string{"Go"}, install: "Go vet", commands: PackageCommands("brew install go", "sudo apt install golang-go", "sudo pacman -S go"), arguments: func(path string) []string {
		return []string{"vet", "./" + filepath.ToSlash(filepath.Dir(path)) + "/..."}
	}},
	{name: "eslint", languages: []string{"JavaScript", "TypeScript", "TSX", "JSX"}, install: "ESLint", commands: PackageCommands("npm install -g eslint", "sudo npm install -g eslint", "sudo npm install -g eslint"), arguments: func(path string) []string { return []string{path} }},
	{name: "biome", languages: []string{"JavaScript", "TypeScript", "TSX", "JSX", "JSON", "CSS"}, install: "Biome", commands: PackageCommands("brew install biome", "npm install -g @biomejs/biome", "sudo pacman -S biome"), arguments: func(path string) []string { return []string{"lint", path} }},
	{name: "ruff", languages: []string{"Python"}, install: "Ruff", commands: PackageCommands("brew install ruff", "pipx install ruff", "sudo pacman -S ruff"), arguments: func(path string) []string { return []string{"check", "--output-format", "concise", path} }},
	{name: "pylint", languages: []string{"Python"}, install: "Pylint", commands: PackageCommands("brew install pylint", "pipx install pylint", "sudo pacman -S pylint"), arguments: func(path string) []string {
		return []string{"--output-format=text", "--msg-template={path}:{line}:{column}: {msg_id} {msg}", path}
	}},
	{name: "cargo", languages: []string{"Rust"}, install: "Cargo Clippy", commands: PackageCommands("brew install rust", "sudo apt install cargo clippy", "sudo pacman -S rust"), arguments: func(string) []string { return []string{"clippy", "--message-format=short"} }},
	{name: "shellcheck", languages: []string{"Bash", "Shell", "Zsh"}, install: "ShellCheck", commands: PackageCommands("brew install shellcheck", "sudo apt install shellcheck", "sudo pacman -S shellcheck"), arguments: func(path string) []string { return []string{"--format=gcc", path} }},
	{name: "markdownlint", languages: []string{"markdown"}, install: "Markdownlint", commands: PackageCommands("npm install -g markdownlint-cli", "sudo npm install -g markdownlint-cli", "sudo npm install -g markdownlint-cli"), arguments: func(path string) []string { return []string{path} }},
	{name: "tflint", languages: []string{"HCL", "Terraform"}, install: "Terraform configuration linter", commands: PackageCommands("brew install tflint", "curl -s https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash", "yay -S tflint"), arguments: func(path string) []string { return []string{"--format", "compact", "--filter", path} }},
	{name: "terraform-fmt", binary: "terraform", languages: []string{"HCL", "Terraform"}, install: "Terraform formatting check", commands: PackageCommands("brew tap hashicorp/tap && brew install hashicorp/tap/terraform", "sudo snap install terraform --classic", "sudo pacman -S terraform"), arguments: func(path string) []string { return []string{"fmt", "-check", "-diff", path} }},
	{name: "yamllint", languages: []string{"YAML"}, install: "YAML syntax and style linter", commands: PackageCommands("brew install yamllint", "sudo apt install yamllint", "sudo pacman -S yamllint"), arguments: func(path string) []string { return []string{"-f", "parsable", path} }},
	{name: "jq", languages: []string{"JSON"}, install: "JSON parser", commands: PackageCommands("brew install jq", "sudo apt install jq", "sudo pacman -S jq"), arguments: func(path string) []string { return []string{"empty", path} }},
}

var lintLocationPattern = regexp.MustCompile(`^(.+?):([0-9]+)(?::([0-9]+))?[: ]+(.+)$`)

// Linters returns the closed set of compatible tools for one detected language.
func Linters(language string) []LinterInfo {
	result := make([]LinterInfo, 0)
	for _, spec := range linterRegistry {
		if !containsFold(spec.languages, language) {
			continue
		}
		_, lookupError := exec.LookPath(spec.executable())
		result = append(result, LinterInfo{Name: spec.name, Available: lookupError == nil, Install: spec.install, Commands: spec.commands})
	}
	return result
}

// RunLinters executes only registered tools against a validated tracked-file path.
func RunLinters(repositoryPath string, relativePath string, language string, names []string) ([]LintReport, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("linting requires a local Git repository")
	}
	if relativePath == "" {
		return nil, errors.New("open a file before linting")
	}
	if _, pathError := SafeRepositoryPath(repositoryPath, relativePath); pathError != nil {
		return nil, pathError
	}
	reports := make([]LintReport, 0, len(names))
	for _, name := range names {
		spec, found := findLinter(name, language)
		if !found {
			return nil, fmt.Errorf("%s is not approved for %s", name, language)
		}
		binaryPath, lookupError := exec.LookPath(spec.executable())
		if lookupError != nil {
			reports = append(reports, LintReport{Linter: name, Error: name + " is not installed"})
			continue
		}
		lintContext, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		command := exec.CommandContext(lintContext, binaryPath, spec.arguments(relativePath)...)
		command.Dir = repositoryPath
		outputBytes, runError := command.CombinedOutput()
		cancel()
		output := strings.TrimSpace(string(outputBytes))
		report := LintReport{Linter: name, Output: output, Diagnostics: parseLintDiagnostics(name, output)}
		if lintContext.Err() == context.DeadlineExceeded {
			report.Error = "lint timed out after 2 minutes"
		} else if runError != nil && output == "" {
			report.Error = runError.Error()
		}
		reports = append(reports, report)
	}
	return reports, nil
}

func (spec linterSpec) executable() string {
	if spec.binary != "" {
		return spec.binary
	}
	return spec.name
}

func findLinter(name string, language string) (linterSpec, bool) {
	for _, spec := range linterRegistry {
		if spec.name == name && containsFold(spec.languages, language) {
			return spec, true
		}
	}
	return linterSpec{}, false
}

func containsFold(values []string, candidate string) bool {
	for _, value := range values {
		if strings.EqualFold(value, candidate) {
			return true
		}
	}
	return false
}

func parseLintDiagnostics(linter string, output string) []LintDiagnostic {
	diagnostics := make([]LintDiagnostic, 0)
	for _, line := range strings.Split(output, "\n") {
		match := lintLocationPattern.FindStringSubmatch(strings.TrimSpace(line))
		if len(match) == 0 {
			continue
		}
		lineNumber, _ := strconv.Atoi(match[2])
		column, _ := strconv.Atoi(match[3])
		message := strings.TrimSpace(match[4])
		severity := "warning"
		lowerMessage := strings.ToLower(message)
		if strings.Contains(lowerMessage, "error") || strings.Contains(lowerMessage, "fatal") {
			severity = "error"
		}
		diagnostics = append(diagnostics, LintDiagnostic{Linter: linter, Path: strings.TrimPrefix(filepath.ToSlash(match[1]), "./"), Line: lineNumber, Column: column, Severity: severity, Message: message})
	}
	return diagnostics
}
