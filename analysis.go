package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// AnalysisService manages cancellable, read-only AI provider processes.
type AnalysisService struct {
	mutex     sync.Mutex
	processes map[string]*exec.Cmd
	sequence  atomic.Uint64
}

// NewAnalysisService creates an empty process registry.
func NewAnalysisService() *AnalysisService {
	return &AnalysisService{processes: make(map[string]*exec.Cmd)}
}

// Start validates a request and starts streaming provider output in the background.
func (service *AnalysisService) Start(runtimeContext context.Context, repositoryPath string, provider string, prompt string) (string, error) {
	if !IsGitRepository(repositoryPath) {
		return "", errors.New("analysis requires a local Git repository")
	}
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return "", errors.New("analysis prompt cannot be empty")
	}
	commandName, commandArguments, commandError := AnalysisCommand(provider, repositoryPath, prompt)
	if commandError != nil {
		return "", commandError
	}
	commandPath, lookupError := ExecutablePath(commandName)
	if lookupError != nil {
		return "", fmt.Errorf("%s is not installed (checked PATH and common GUI locations)", commandName)
	}
	jobID := fmt.Sprintf("analysis-%d", service.sequence.Add(1))
	command := exec.Command(commandPath, commandArguments...)
	command.Dir = repositoryPath
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
	emitAnalysisEvent(runtimeContext, AnalysisEvent{JobID: jobID, Provider: provider, Kind: "started"})
	go service.stream(runtimeContext, jobID, provider, command, bufio.NewScanner(outputPipe))
	return jobID, nil
}

// stream forwards process output and always removes the completed job.
func (service *AnalysisService) stream(runtimeContext context.Context, jobID string, provider string, command *exec.Cmd, outputScanner *bufio.Scanner) {
	outputScanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for outputScanner.Scan() {
		emitAnalysisEvent(runtimeContext, AnalysisEvent{JobID: jobID, Provider: provider, Kind: "output", Text: outputScanner.Text()})
	}
	waitError := command.Wait()
	service.mutex.Lock()
	delete(service.processes, jobID)
	service.mutex.Unlock()
	eventKind, eventText := "finished", ""
	if waitError != nil {
		eventKind, eventText = "error", waitError.Error()
	}
	emitAnalysisEvent(runtimeContext, AnalysisEvent{JobID: jobID, Provider: provider, Kind: eventKind, Text: eventText})
}

func emitAnalysisEvent(runtimeContext context.Context, event AnalysisEvent) {
	if runtimeContext == nil || runtimeContext.Value("events") == nil {
		return
	}
	wailsruntime.EventsEmit(runtimeContext, "analysis:event", event)
}

// Cancel terminates one running provider process without affecting other jobs.
func (service *AnalysisService) Cancel(jobID string) error {
	service.mutex.Lock()
	command := service.processes[jobID]
	service.mutex.Unlock()
	if command == nil || command.Process == nil {
		return errors.New("analysis job is not running")
	}
	return command.Process.Kill()
}

// AnalysisCommand builds the audited read-only argument vector for each provider.
func AnalysisCommand(provider string, repositoryPath string, prompt string) (string, []string, error) {
	switch strings.ToLower(provider) {
	case "codex":
		return "codex", []string{"exec", "--sandbox", "read-only", "--json", "--color", "never", "--cd", repositoryPath, prompt}, nil
	case "claude":
		return "claude", []string{"-p", prompt, "--allowedTools", "Read,Glob,Grep", "--output-format", "stream-json", "--verbose"}, nil
	default:
		return "", nil, fmt.Errorf("unsupported analysis provider %q", provider)
	}
}
