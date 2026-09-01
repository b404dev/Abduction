package backend

import (
	"errors"
	"fmt"
	"strings"
	"sync"
)

var ErrNoGitHubRemote = errors.New("repository has no GitHub remote")
var ErrRemoteFileNotFound = errors.New("remote file not found")

type GitCommandError struct {
	Arguments []string
	Output    string
	Err       error
}

func (commandError *GitCommandError) Error() string {
	return fmt.Sprintf("git %s failed: %s: %v", strings.Join(commandError.Arguments, " "), commandError.Output, commandError.Err)
}

func (commandError *GitCommandError) Unwrap() error { return commandError.Err }

// RepositoryService owns local repository discovery and read-only Git queries.
type RepositoryService struct {
	config          Config
	remoteMutex     sync.RWMutex
	remoteSnapshots map[string]map[string][]byte
}

// NewRepositoryService creates repository operations from the current configuration.
func NewRepositoryService(configuration Config) *RepositoryService {
	return &RepositoryService{config: configuration, remoteSnapshots: make(map[string]map[string][]byte)}
}
