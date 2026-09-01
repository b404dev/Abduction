package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// scannerSpec keeps each executable's closed argument builder in one audited registry.
type scannerSpec struct {
	name             string
	install          string
	commands         []InstallCommand
	arguments        func(string) []string
	workingDirectory bool
}

// scannerRegistry is the complete command allowlist for security execution.
var scannerRegistry = []scannerSpec{
	{name: "gitleaks", install: "Secret scanner", commands: PackageCommands("brew install gitleaks", "go install github.com/gitleaks/gitleaks/v8@latest", "sudo pacman -S gitleaks"), arguments: func(repositoryPath string) []string {
		return []string{"detect", "--source", repositoryPath, "--no-banner", "-v"}
	}},
	{name: "osv-scanner", install: "Dependency scanner", commands: PackageCommands("brew install osv-scanner", "go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest", "sudo pacman -S osv-scanner"), arguments: func(repositoryPath string) []string { return []string{"scan", "source", "-r", repositoryPath} }},
	{name: "gosec", install: "Go security scanner", commands: PackageCommands("brew install gosec", "go install github.com/securego/gosec/v2/cmd/gosec@latest", "go install github.com/securego/gosec/v2/cmd/gosec@latest"), arguments: func(repositoryPath string) []string { return []string{"./..."} }, workingDirectory: true},
	{name: "trivy", install: "Vulnerability scanner", commands: PackageCommands("brew install trivy", "sudo apt install trivy", "sudo pacman -S trivy"), arguments: func(repositoryPath string) []string {
		return []string{"fs", "--scanners", "vuln,secret,misconfig", repositoryPath}
	}},
	{name: "semgrep", install: "Static analysis", commands: PackageCommands("brew install semgrep", "pipx install semgrep", "pipx install semgrep"), arguments: func(repositoryPath string) []string { return []string{"scan", "--config", "auto", repositoryPath} }},
}

// SecurityService owns cancellable scanner processes.
type SecurityService struct {
	mutex     sync.Mutex
	processes map[string]*exec.Cmd
	sequence  atomic.Uint64
}

// NewSecurityService creates an empty scanner process registry.
func NewSecurityService() *SecurityService {
	return &SecurityService{processes: make(map[string]*exec.Cmd)}
}

// Scanners reports availability without running any scanner.
func (service *SecurityService) Scanners() []ScannerInfo {
	result := make([]ScannerInfo, 0, len(scannerRegistry))
	for _, scanner := range scannerRegistry {
		_, lookupError := exec.LookPath(scanner.name)
		result = append(result, ScannerInfo{Name: scanner.name, Available: lookupError == nil, Install: scanner.install, Commands: scanner.commands})
	}
	return result
}

// Start validates the scanner allowlist and begins a live scan.
func (service *SecurityService) Start(runtimeContext context.Context, repositoryPath string, scannerName string) (string, error) {
	if !IsGitRepository(repositoryPath) {
		return "", errors.New("scan requires a local Git repository")
	}
	scanner, found := findScanner(scannerName)
	if !found {
		return "", errors.New("unknown scanner")
	}
	if _, lookupError := exec.LookPath(scanner.name); lookupError != nil {
		return "", fmt.Errorf("%s is not installed", scanner.name)
	}
	jobID := fmt.Sprintf("scan-%d", service.sequence.Add(1))
	command := exec.Command(scanner.name, scanner.arguments(repositoryPath)...)
	if scanner.workingDirectory {
		command.Dir = repositoryPath
	}
	outputPipe, pipeError := command.StdoutPipe()
	if pipeError != nil {
		return "", pipeError
	}
	command.Stderr = command.Stdout
	if startError := command.Start(); startError != nil {
		return "", startError
	}
	service.mutex.Lock()
	service.processes[jobID] = command
	service.mutex.Unlock()
	wailsruntime.EventsEmit(runtimeContext, "scan:event", ScanEvent{JobID: jobID, Scanner: scanner.name, Kind: "started"})
	go service.stream(runtimeContext, jobID, scanner.name, command, bufio.NewScanner(outputPipe), repositoryPath)
	return jobID, nil
}

// stream broadcasts output and archives a complete plain-text report.
func (service *SecurityService) stream(runtimeContext context.Context, jobID string, scannerName string, command *exec.Cmd, outputScanner *bufio.Scanner, repositoryPath string) {
	lines := make([]string, 0)
	outputScanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for outputScanner.Scan() {
		line := outputScanner.Text()
		lines = append(lines, line)
		wailsruntime.EventsEmit(runtimeContext, "scan:event", ScanEvent{JobID: jobID, Scanner: scannerName, Kind: "output", Text: line})
	}
	scanError := outputScanner.Err()
	waitError := command.Wait()
	service.mutex.Lock()
	delete(service.processes, jobID)
	service.mutex.Unlock()
	reportPath, archiveError := archiveScan(repositoryPath, scannerName, lines)
	eventKind, eventText := "finished", ""
	if scanError != nil {
		eventKind, eventText = "error", fmt.Sprintf("read scanner output: %v", scanError)
	} else if waitError != nil {
		eventKind, eventText = "findings", waitError.Error()
	}
	if archiveError != nil {
		if eventText != "" {
			eventText += "; "
		}
		eventKind = "error"
		eventText += fmt.Sprintf("archive scanner report: %v", archiveError)
	}
	wailsruntime.EventsEmit(runtimeContext, "scan:event", ScanEvent{JobID: jobID, Scanner: scannerName, Kind: eventKind, Text: eventText, ReportPath: reportPath})
}

// Cancel terminates one scanner job without affecting other work.
func (service *SecurityService) Cancel(jobID string) error {
	service.mutex.Lock()
	command := service.processes[jobID]
	service.mutex.Unlock()
	if command == nil || command.Process == nil {
		return errors.New("scan job is not running")
	}
	return command.Process.Kill()
}

// findScanner resolves a scanner only from the closed registry.
func findScanner(scannerName string) (scannerSpec, bool) {
	for _, scanner := range scannerRegistry {
		if scanner.name == scannerName {
			return scanner, true
		}
	}
	return scannerSpec{}, false
}

// archiveScan stores scanner output under Abduction's configuration directory.
func archiveScan(repositoryPath string, scannerName string, lines []string) (string, error) {
	repositoryName := filepath.Base(repositoryPath)
	reportDirectory := filepath.Join(ConfigDirectory(), "scans", repositoryName)
	if makeError := os.MkdirAll(reportDirectory, 0o755); makeError != nil {
		return "", makeError
	}
	reportPath := filepath.Join(reportDirectory, fmt.Sprintf("%s-%s.txt", scannerName, time.Now().Format("20060102-150405")))
	reportText := ""
	for _, line := range lines {
		reportText += line + "\n"
	}
	if writeError := os.WriteFile(reportPath, []byte(reportText), 0o600); writeError != nil {
		return "", writeError
	}
	return reportPath, nil
}
