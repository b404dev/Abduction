package main

import (
	"os/exec"
	"strings"
)

// DetectTools reports the optional host tools that unlock deeper features.
func DetectTools() []Tool {
	tools := []Tool{
		{Name: "git", Install: "Git source control", Commands: PackageCommands("brew install git", "sudo apt install git", "sudo pacman -S git")},
		{Name: "gh", Install: "GitHub CLI", Commands: PackageCommands("brew install gh", "sudo apt install gh", "sudo pacman -S github-cli")},
		{Name: "claude", Install: "Claude Code", Commands: PackageCommands("brew install --cask claude-code", "curl -fsSL https://claude.ai/install.sh | bash", "curl -fsSL https://claude.ai/install.sh | bash")},
		{Name: "codex", Install: "OpenAI Codex", Commands: PackageCommands("brew install --cask codex", "curl -fsSL https://chatgpt.com/codex/install.sh | sh", "curl -fsSL https://chatgpt.com/codex/install.sh | sh")},
		{Name: "gitleaks", Install: "Secret scanner", Commands: PackageCommands("brew install gitleaks", "go install github.com/gitleaks/gitleaks/v8@latest", "sudo pacman -S gitleaks")},
		{Name: "osv-scanner", Install: "Dependency scanner", Commands: PackageCommands("brew install osv-scanner", "go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest", "sudo pacman -S osv-scanner")},
		{Name: "gosec", Install: "Go security scanner", Commands: PackageCommands("brew install gosec", "go install github.com/securego/gosec/v2/cmd/gosec@latest", "go install github.com/securego/gosec/v2/cmd/gosec@latest")},
		{Name: "trivy", Install: "Vulnerability scanner", Commands: PackageCommands("brew install trivy", "sudo apt install trivy", "sudo pacman -S trivy")},
		{Name: "semgrep", Install: "Static analysis", Commands: PackageCommands("brew install semgrep", "pipx install semgrep", "pipx install semgrep")},
	}
	for toolIndex := range tools {
		switch tools[toolIndex].Name {
		case "claude", "codex":
			tools[toolIndex].Category = "AI providers"
		case "gitleaks", "osv-scanner", "gosec", "trivy", "semgrep":
			tools[toolIndex].Category = "Security scanners"
		default:
			tools[toolIndex].Category = "Core integration"
		}
	}
	knownTools := make(map[string]bool)
	for _, tool := range tools {
		knownTools[tool.Name] = true
	}
	for _, linter := range linterRegistry {
		if knownTools[linter.name] {
			continue
		}
		tools = append(tools, Tool{Name: linter.name, Install: linter.install, Category: "Language linters", Languages: linter.languages, Commands: linter.commands})
		knownTools[linter.name] = true
	}
	for toolIndex := range tools {
		if tools[toolIndex].Languages == nil {
			tools[toolIndex].Languages = []string{}
		}
		binaryName := tools[toolIndex].Name
		if linter, found := findLinterByName(tools[toolIndex].Name); found {
			binaryName = linter.executable()
		}
		binaryPath, lookupError := exec.LookPath(binaryName)
		if lookupError != nil {
			continue
		}
		tools[toolIndex].Available = true
		versionCommand := exec.Command(binaryPath, "--version")
		versionBytes, versionError := versionCommand.CombinedOutput()
		if versionError == nil {
			versionLines := strings.Split(strings.TrimSpace(string(versionBytes)), "\n")
			if len(versionLines) > 0 {
				tools[toolIndex].Version = versionLines[0]
			}
		}
	}
	return tools
}

func findLinterByName(name string) (linterSpec, bool) {
	for _, linter := range linterRegistry {
		if linter.name == name {
			return linter, true
		}
	}
	return linterSpec{}, false
}

// PackageCommands creates the standard package-manager choices shown in the UI.
func PackageCommands(brewCommand string, aptCommand string, pacmanCommand string) []InstallCommand {
	return []InstallCommand{{Manager: "macOS · Brew", Command: brewCommand}, {Manager: "Ubuntu · APT", Command: aptCommand}, {Manager: "Arch · Pacman", Command: pacmanCommand}}
}
