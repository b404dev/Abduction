package backend

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// ListFast discovers immediate Git checkouts without running repository analysis.
func (service *RepositoryService) ListFast() ([]Repo, error) {
	directoryEntries, readError := os.ReadDir(service.config.Workspace)
	if readError != nil {
		return []Repo{}, fmt.Errorf("cannot read workspace %q: %w", service.config.Workspace, readError)
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
		repositories = append(repositories, Repo{Name: directoryEntry.Name(), Owner: "local", FullName: "local/" + directoryEntry.Name(), Path: repositoryPath})
	}
	sort.Slice(repositories, func(leftIndex int, rightIndex int) bool {
		return strings.ToLower(repositories[leftIndex].Name) < strings.ToLower(repositories[rightIndex].Name)
	})
	return repositories, nil
}

// List discovers immediate Git checkouts in the configured workspace.
func (service *RepositoryService) List() ([]Repo, error) {
	fastRepositories, readError := service.ListFast()
	if readError != nil {
		return nil, readError
	}
	repositories := make([]Repo, 0, len(fastRepositories))
	for _, fastRepository := range fastRepositories {
		repositoryPath := fastRepository.Path
		owner, name, githubURL, identityError := RemoteIdentity(repositoryPath)
		if identityError != nil && !errors.Is(identityError, ErrNoGitHubRemote) {
			return nil, fmt.Errorf("inspect repository %q: %w", repositoryPath, identityError)
		}
		if name == "" {
			name = fastRepository.Name
		}
		if owner == "" {
			owner = "local"
		}
		branch, branchError := RunGit(repositoryPath, "branch", "--show-current")
		if branchError != nil {
			return nil, fmt.Errorf("inspect branch for %q: %w", repositoryPath, branchError)
		}
		updated := ""
		head, headError := RunGit(repositoryPath, "rev-parse", "--verify", "--quiet", "HEAD")
		if headError != nil && !isGitExitCode(headError, 1) {
			return nil, fmt.Errorf("inspect HEAD for %q: %w", repositoryPath, headError)
		}
		if head != "" {
			latestUpdate, updatedError := RunGit(repositoryPath, "log", "-1", "--format=%cI")
			if updatedError != nil {
				return nil, fmt.Errorf("inspect latest commit for %q: %w", repositoryPath, updatedError)
			}
			updated = latestUpdate
		}
		repositories = append(repositories, Repo{
			Name: name, Owner: owner, FullName: owner + "/" + name,
			Path: repositoryPath, Branch: branch,
			Updated:  updated,
			Language: DetectRepositoryLanguage(repositoryPath), GitHubURL: githubURL,
		})
	}
	sort.Slice(repositories, func(leftIndex int, rightIndex int) bool {
		return strings.ToLower(repositories[leftIndex].Name) < strings.ToLower(repositories[rightIndex].Name)
	})
	return repositories, nil
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
	gitBinary, gitLookupError := GitExecutable()
	if gitLookupError != nil {
		return Repo{}, gitLookupError
	}
	command := exec.Command(gitBinary, "clone", "--", trimmedURL, destinationPath)
	if githubRepositoryName := GitHubRepositoryName(trimmedURL); githubRepositoryName != "" {
		githubPath, lookupError := ExecutablePath("gh")
		if lookupError != nil {
			return Repo{}, errors.New("GitHub CLI is required to clone this authenticated repository")
		}
		command = exec.Command(githubPath, "repo", "clone", githubRepositoryName, destinationPath)
	}
	outputBytes, cloneError := command.CombinedOutput()
	if cloneError != nil {
		return Repo{}, fmt.Errorf("clone failed: %s", strings.TrimSpace(string(outputBytes)))
	}
	repositories, listError := service.List()
	if listError != nil {
		return Repo{}, fmt.Errorf("repository cloned but workspace refresh failed: %w", listError)
	}
	for _, repository := range repositories {
		if repository.Path == destinationPath {
			return repository, nil
		}
	}
	return Repo{}, errors.New("repository cloned but could not be discovered")
}

// GitHubRepositoryName extracts owner/name from supported GitHub clone URLs.
func GitHubRepositoryName(repositoryURL string) string {
	normalizedURL := strings.TrimSuffix(strings.TrimSpace(repositoryURL), ".git")
	normalizedURL = strings.TrimSuffix(normalizedURL, "/")
	for _, prefix := range []string{"https://github.com/", "http://github.com/", "ssh://git@github.com/", "git@github.com:"} {
		if strings.HasPrefix(normalizedURL, prefix) {
			fullName := strings.TrimPrefix(normalizedURL, prefix)
			if regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`).MatchString(fullName) {
				return fullName
			}
		}
	}
	return ""
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
