package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
)

var ErrNoGitHubRemote = errors.New("repository has no GitHub remote")

// RepositoryService owns local repository discovery and read-only Git queries.
type RepositoryService struct {
	config Config
}

// NewRepositoryService creates repository operations from the current configuration.
func NewRepositoryService(configuration Config) *RepositoryService {
	return &RepositoryService{config: configuration}
}

// List discovers immediate Git checkouts in the configured workspace.
func (service *RepositoryService) List() []Repo {
	directoryEntries, readError := os.ReadDir(service.config.Workspace)
	if readError != nil {
		return []Repo{}
	}
	repositories := make([]Repo, 0)
	for _, directoryEntry := range directoryEntries {
		if !directoryEntry.IsDir() {
			continue
		}
		repositoryPath := filepath.Join(service.config.Workspace, directoryEntry.Name())
		if !IsGitRepository(repositoryPath) {
			continue
		}
		owner, name, githubURL := RemoteIdentity(repositoryPath)
		if name == "" {
			name = directoryEntry.Name()
		}
		if owner == "" {
			owner = "local"
		}
		repositories = append(repositories, Repo{
			Name: name, Owner: owner, FullName: owner + "/" + name,
			Path: repositoryPath, Branch: RunGit(repositoryPath, "branch", "--show-current"),
			Updated:  RunGit(repositoryPath, "log", "-1", "--format=%cI"),
			Language: DetectRepositoryLanguage(repositoryPath), GitHubURL: githubURL,
		})
	}
	sort.Slice(repositories, func(leftIndex int, rightIndex int) bool {
		return strings.ToLower(repositories[leftIndex].Name) < strings.ToLower(repositories[rightIndex].Name)
	})
	return repositories
}

// Clone downloads a remote repository into the configured workspace safely.
func (service *RepositoryService) Clone(repositoryURL string) (Repo, error) {
	trimmedURL := strings.TrimSpace(repositoryURL)
	if !strings.HasPrefix(trimmedURL, "https://") && !strings.HasPrefix(trimmedURL, "ssh://") && !strings.HasPrefix(trimmedURL, "git@") {
		return Repo{}, errors.New("clone URL must use HTTPS or SSH")
	}
	urlPath := strings.TrimSuffix(strings.ReplaceAll(trimmedURL, "\\", "/"), "/")
	repositoryName := strings.TrimSuffix(filepath.Base(urlPath), ".git")
	if repositoryName == "" || repositoryName == "." || repositoryName == ".." || strings.ContainsAny(repositoryName, "/\\") {
		return Repo{}, errors.New("clone URL has no valid repository name")
	}
	destinationPath, pathError := SafeRepositoryPath(service.config.Workspace, repositoryName)
	if pathError != nil {
		return Repo{}, pathError
	}
	if _, statError := os.Stat(destinationPath); !os.IsNotExist(statError) {
		return Repo{}, errors.New("a workspace folder with this repository name already exists")
	}
	command := exec.Command("git", "clone", "--", trimmedURL, destinationPath)
	outputBytes, cloneError := command.CombinedOutput()
	if cloneError != nil {
		return Repo{}, fmt.Errorf("clone failed: %s", strings.TrimSpace(string(outputBytes)))
	}
	for _, repository := range service.List() {
		if repository.Path == destinationPath {
			return repository, nil
		}
	}
	return Repo{}, errors.New("repository cloned but could not be discovered")
}

// ListDirectory returns directories first and hides Git's internal metadata.
func (service *RepositoryService) ListDirectory(repositoryPath string, relativePath string) ([]TreeEntry, error) {
	directoryPath, pathError := SafeRepositoryPath(repositoryPath, relativePath)
	if pathError != nil {
		return nil, pathError
	}
	directoryEntries, readError := os.ReadDir(directoryPath)
	if readError != nil {
		return nil, readError
	}
	entries := make([]TreeEntry, 0, len(directoryEntries))
	for _, directoryEntry := range directoryEntries {
		if directoryEntry.Name() == ".git" {
			continue
		}
		entryKind := "file"
		entrySize := int64(0)
		if directoryEntry.IsDir() {
			entryKind = "directory"
		} else if entryInfo, infoError := directoryEntry.Info(); infoError == nil {
			entrySize = entryInfo.Size()
		}
		entries = append(entries, TreeEntry{
			Name: directoryEntry.Name(), Path: filepath.ToSlash(filepath.Join(relativePath, directoryEntry.Name())),
			Kind: entryKind, Size: entrySize,
		})
	}
	sort.Slice(entries, func(leftIndex int, rightIndex int) bool {
		if entries[leftIndex].Kind != entries[rightIndex].Kind {
			return entries[leftIndex].Kind == "directory"
		}
		return strings.ToLower(entries[leftIndex].Name) < strings.ToLower(entries[rightIndex].Name)
	})
	return entries, nil
}

// Search finds a bounded set of tracked text matches without invoking a shell.
func (service *RepositoryService) Search(repositoryPath string, query string, limit int) ([]SearchResult, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("not a Git repository")
	}
	trimmedQuery := strings.TrimSpace(query)
	if len(trimmedQuery) < 2 {
		return []SearchResult{}, nil
	}
	command := exec.Command("git", "grep", "-n", "-I", "--full-name", "-e", trimmedQuery, "--")
	command.Dir = repositoryPath
	outputBytes, commandError := command.Output()
	if commandError != nil {
		var exitError *exec.ExitError
		if errors.As(commandError, &exitError) && exitError.ExitCode() == 1 {
			return []SearchResult{}, nil
		}
		return nil, commandError
	}
	results := make([]SearchResult, 0)
	for _, outputLine := range strings.Split(string(outputBytes), "\n") {
		matchParts := strings.SplitN(outputLine, ":", 3)
		if len(matchParts) != 3 {
			continue
		}
		lineNumber, conversionError := strconv.Atoi(matchParts[1])
		if conversionError != nil {
			continue
		}
		results = append(results, SearchResult{Path: matchParts[0], Line: lineNumber, Preview: strings.TrimSpace(matchParts[2]), Kind: "content"})
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

// SearchFiles finds tracked paths by filename or directory fragment.
func (service *RepositoryService) SearchFiles(repositoryPath string, query string, limit int) ([]SearchResult, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("not a Git repository")
	}
	trimmedQuery := strings.ToLower(strings.TrimSpace(query))
	if len(trimmedQuery) < 2 {
		return []SearchResult{}, nil
	}
	command := exec.Command("git", "ls-files", "-z")
	command.Dir = repositoryPath
	outputBytes, commandError := command.Output()
	if commandError != nil {
		return nil, commandError
	}
	results := make([]SearchResult, 0)
	for _, trackedPath := range strings.Split(string(outputBytes), "\x00") {
		if trackedPath == "" || !strings.Contains(strings.ToLower(trackedPath), trimmedQuery) {
			continue
		}
		results = append(results, SearchResult{Path: trackedPath, Preview: filepath.Dir(trackedPath), Kind: "file"})
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

// Commits reads all refs in Git's topological graph order.
func (service *RepositoryService) Commits(repositoryPath string, limit int) ([]Commit, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("not a Git repository")
	}
	format := "%x1e%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1f%D%x1f%P"
	command := exec.Command("git", "log", "--all", "--graph", "--topo-order", fmt.Sprintf("-%d", limit), "--date=iso-strict", "--pretty=format:"+format)
	command.Dir = repositoryPath
	outputBytes, commandError := command.Output()
	if commandError != nil {
		return nil, commandError
	}
	commits := make([]Commit, 0)
	pendingConnectors := make([]string, 0)
	for _, outputLine := range strings.Split(string(outputBytes), "\n") {
		recordIndex := strings.Index(outputLine, "\x1e")
		if recordIndex < 0 {
			connector := strings.TrimRight(outputLine, " ")
			if connector != "" {
				pendingConnectors = append(pendingConnectors, connector)
			}
			continue
		}
		graphPrefix := strings.TrimRight(outputLine[:recordIndex], " ")
		commitFields := strings.Split(outputLine[recordIndex+1:], "\x1f")
		if len(commitFields) != 7 {
			continue
		}
		commits = append(commits, Commit{Hash: commitFields[0], Short: commitFields[1], Subject: commitFields[2], Author: commitFields[3], Date: commitFields[4], Refs: commitFields[5], Parents: strings.Fields(commitFields[6]), Graph: graphPrefix, Connectors: pendingConnectors})
		pendingConnectors = make([]string, 0)
	}
	return commits, nil
}

// PullRequests asks the authenticated GitHub CLI for review items in this checkout.
func (service *RepositoryService) PullRequests(repositoryPath string) ([]PullRequest, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("not a Git repository")
	}
	if _, lookupError := exec.LookPath("gh"); lookupError != nil {
		return nil, errors.New("GitHub CLI is not installed")
	}
	command := exec.Command("gh", "pr", "list", "--state", "all", "--limit", "100", "--json", "number,title,author,state,isDraft,updatedAt,url,headRefName,baseRefName")
	command.Dir = repositoryPath
	outputBytes, commandError := command.CombinedOutput()
	if commandError != nil {
		return nil, fmt.Errorf("GitHub pull requests unavailable: %s", strings.TrimSpace(string(outputBytes)))
	}
	var githubItems []struct {
		Number     int    `json:"number"`
		Title      string `json:"title"`
		State      string `json:"state"`
		Draft      bool   `json:"isDraft"`
		Updated    string `json:"updatedAt"`
		URL        string `json:"url"`
		HeadBranch string `json:"headRefName"`
		BaseBranch string `json:"baseRefName"`
		Author     struct {
			Login string `json:"login"`
		} `json:"author"`
	}
	if decodeError := json.Unmarshal(outputBytes, &githubItems); decodeError != nil {
		return nil, decodeError
	}
	pullRequests := make([]PullRequest, 0, len(githubItems))
	for _, githubItem := range githubItems {
		pullRequests = append(pullRequests, PullRequest{Number: githubItem.Number, Title: githubItem.Title, Author: githubItem.Author.Login, State: githubItem.State, Draft: githubItem.Draft, Updated: githubItem.Updated, URL: githubItem.URL, HeadBranch: githubItem.HeadBranch, BaseBranch: githubItem.BaseBranch})
	}
	return pullRequests, nil
}

// Branches lists local and remote branches with remote prefixes removed.
func (service *RepositoryService) Branches(repositoryPath string) ([]string, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("not a Git repository")
	}
	rawBranches := RunGit(repositoryPath, "for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes/origin")
	seenBranches := make(map[string]bool)
	branches := make([]string, 0)
	for _, rawBranch := range strings.Split(rawBranches, "\n") {
		branch := strings.TrimPrefix(strings.TrimSpace(rawBranch), "origin/")
		if branch == "" || branch == "HEAD" || seenBranches[branch] {
			continue
		}
		seenBranches[branch] = true
		branches = append(branches, branch)
	}
	sort.Strings(branches)
	return branches, nil
}

// SwitchBranch checks out an existing branch without forcing or discarding work.
func (service *RepositoryService) SwitchBranch(repositoryPath string, branch string) (string, error) {
	if !IsGitRepository(repositoryPath) {
		return "", errors.New("not a Git repository")
	}
	knownBranches, branchError := service.Branches(repositoryPath)
	if branchError != nil {
		return "", branchError
	}
	branchKnown := false
	for _, knownBranch := range knownBranches {
		if knownBranch == branch {
			branchKnown = true
			break
		}
	}
	if !branchKnown {
		return "", errors.New("branch is not present in this repository")
	}
	command := exec.Command("git", "checkout", branch)
	command.Dir = repositoryPath
	outputBytes, checkoutError := command.CombinedOutput()
	if checkoutError != nil {
		return "", fmt.Errorf("checkout failed: %s", strings.TrimSpace(string(outputBytes)))
	}
	return RunGit(repositoryPath, "branch", "--show-current"), nil
}

// OpenInEditor starts the configured editor without blocking Reaper.
func (service *RepositoryService) OpenInEditor(repositoryPath string, relativePath string) error {
	targetPath, pathError := SafeRepositoryPath(repositoryPath, relativePath)
	if pathError != nil {
		return pathError
	}
	editorParts := strings.Fields(service.config.Editor)
	if len(editorParts) == 0 {
		return errors.New("no editor configured")
	}
	commandArguments := append(editorParts[1:], targetPath)
	return exec.Command(editorParts[0], commandArguments...).Start()
}

// SafeRepositoryPath resolves a path and proves that it remains inside its repository.
func SafeRepositoryPath(repositoryPath string, relativePath string) (string, error) {
	repositoryAbsolute, repositoryError := filepath.Abs(repositoryPath)
	if repositoryError != nil {
		return "", repositoryError
	}
	targetAbsolute, targetError := filepath.Abs(filepath.Join(repositoryPath, filepath.Clean(relativePath)))
	if targetError != nil {
		return "", targetError
	}
	if targetAbsolute != repositoryAbsolute && !strings.HasPrefix(targetAbsolute, repositoryAbsolute+string(os.PathSeparator)) {
		return "", errors.New("path leaves repository")
	}
	return targetAbsolute, nil
}

// IsGitRepository reports whether a path contains Git metadata.
func IsGitRepository(repositoryPath string) bool {
	gitInfo, statError := os.Stat(filepath.Join(repositoryPath, ".git"))
	return statError == nil && (gitInfo.IsDir() || gitInfo.Mode().IsRegular())
}

// RunGit returns trimmed stdout for a small read-only Git query.
func RunGit(repositoryPath string, arguments ...string) string {
	command := exec.Command("git", arguments...)
	command.Dir = repositoryPath
	outputBytes, commandError := command.Output()
	if commandError != nil {
		return ""
	}
	return strings.TrimSpace(string(outputBytes))
}

// RemoteIdentity extracts an owner, repository name, and browser URL from origin.
func RemoteIdentity(repositoryPath string) (string, string, string) {
	remote := strings.TrimSuffix(RunGit(repositoryPath, "remote", "get-url", "origin"), ".git")
	if remote == "" {
		return "", "", ""
	}
	normalized := strings.Replace(remote, "git@github.com:", "https://github.com/", 1)
	if !strings.HasPrefix(normalized, "https://github.com/") {
		return "", "", ""
	}
	pathParts := strings.Split(strings.TrimPrefix(normalized, "https://github.com/"), "/")
	if len(pathParts) < 2 {
		return "", "", ""
	}
	return pathParts[0], pathParts[1], "https://github.com/" + pathParts[0] + "/" + pathParts[1]
}

// PlatformName returns a friendly operating-system name for diagnostics.
func PlatformName() string {
	platformNames := map[string]string{"linux": "Linux", "darwin": "macOS", "windows": "Windows"}
	if platformName := platformNames[runtime.GOOS]; platformName != "" {
		return platformName
	}
	return runtime.GOOS
}
