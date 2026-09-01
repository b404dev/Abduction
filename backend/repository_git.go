package backend

import (
	"context"
	"crypto/sha256"
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
	"time"
)

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

// PullRequestDetail loads one pull request's metadata and unified patch through GitHub CLI.
func (service *RepositoryService) PullRequestDetail(repositoryPath string, number int) (PullRequestDetail, error) {
	if !IsGitRepository(repositoryPath) {
		return PullRequestDetail{}, errors.New("not a Git repository")
	}
	if number < 1 {
		return PullRequestDetail{}, errors.New("pull request number must be positive")
	}
	if _, lookupError := exec.LookPath("gh"); lookupError != nil {
		return PullRequestDetail{}, errors.New("GitHub CLI is not installed")
	}
	pullRequestNumber := strconv.Itoa(number)
	requestContext, cancelRequest := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancelRequest()
	viewCommand := exec.CommandContext(requestContext, "gh", "pr", "view", pullRequestNumber, "--json", "number,title,author,state,isDraft,updatedAt,url,headRefName,baseRefName,body,additions,deletions,changedFiles,commits,reviewDecision,mergeable,files")
	viewCommand.Dir = repositoryPath
	viewBytes, viewError := viewCommand.CombinedOutput()
	if viewError != nil {
		return PullRequestDetail{}, fmt.Errorf("GitHub pull request #%d unavailable: %s", number, strings.TrimSpace(string(viewBytes)))
	}
	diffCommand := exec.CommandContext(requestContext, "gh", "pr", "diff", pullRequestNumber, "--patch")
	diffCommand.Dir = repositoryPath
	diffBytes, diffError := diffCommand.CombinedOutput()
	if diffError != nil {
		return PullRequestDetail{}, fmt.Errorf("GitHub pull request #%d diff unavailable: %s", number, strings.TrimSpace(string(diffBytes)))
	}
	const maximumDiffSize = 4 * 1024 * 1024
	if len(diffBytes) > maximumDiffSize {
		diffBytes = append(diffBytes[:maximumDiffSize], []byte("\n\n[Diff truncated at 4 MiB. Open on GitHub for the complete patch.]\n")...)
	}
	return decodePullRequestDetail(viewBytes, string(diffBytes))
}

// decodePullRequestDetail converts GitHub CLI JSON into the stable frontend contract.
func decodePullRequestDetail(viewBytes []byte, diff string) (PullRequestDetail, error) {
	var githubItem struct {
		Number         int               `json:"number"`
		Title          string            `json:"title"`
		State          string            `json:"state"`
		Draft          bool              `json:"isDraft"`
		Updated        string            `json:"updatedAt"`
		URL            string            `json:"url"`
		HeadBranch     string            `json:"headRefName"`
		BaseBranch     string            `json:"baseRefName"`
		Body           string            `json:"body"`
		Additions      int               `json:"additions"`
		Deletions      int               `json:"deletions"`
		ChangedFiles   int               `json:"changedFiles"`
		Commits        []json.RawMessage `json:"commits"`
		ReviewDecision string            `json:"reviewDecision"`
		Mergeable      string            `json:"mergeable"`
		Files          []PullRequestFile `json:"files"`
		Author         struct {
			Login string `json:"login"`
		} `json:"author"`
	}
	if decodeError := json.Unmarshal(viewBytes, &githubItem); decodeError != nil {
		return PullRequestDetail{}, fmt.Errorf("decode pull request detail: %w", decodeError)
	}
	return PullRequestDetail{
		PullRequest: PullRequest{Number: githubItem.Number, Title: githubItem.Title, Author: githubItem.Author.Login, State: githubItem.State, Draft: githubItem.Draft, Updated: githubItem.Updated, URL: githubItem.URL, HeadBranch: githubItem.HeadBranch, BaseBranch: githubItem.BaseBranch},
		Body:        githubItem.Body, Additions: githubItem.Additions, Deletions: githubItem.Deletions, ChangedFiles: githubItem.ChangedFiles, Commits: len(githubItem.Commits), ReviewDecision: githubItem.ReviewDecision, Mergeable: githubItem.Mergeable, Files: githubItem.Files, Diff: diff,
	}, nil
}

// Branches lists local and remote branches with remote prefixes removed.
func (service *RepositoryService) Branches(repositoryPath string) ([]string, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("not a Git repository")
	}
	rawBranches, branchError := RunGit(repositoryPath, "for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes/origin")
	if branchError != nil {
		return nil, branchError
	}
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
	return RunGit(repositoryPath, "branch", "--show-current")
}

// PullLatest fast-forwards the active branch without creating an implicit merge.
func (service *RepositoryService) PullLatest(repositoryPath string) (string, error) {
	if !IsGitRepository(repositoryPath) {
		return "", errors.New("not a Git repository")
	}
	command := exec.Command("git", "pull", "--ff-only")
	command.Dir = repositoryPath
	outputBytes, pullError := command.CombinedOutput()
	output := strings.TrimSpace(string(outputBytes))
	if pullError != nil {
		if output == "" {
			output = pullError.Error()
		}
		return "", fmt.Errorf("pull latest failed: %s", output)
	}
	if output == "" {
		output = "Repository is up to date."
	}
	return output, nil
}

// Fingerprint cheaply identifies commits and working-tree paths that changed.
func (service *RepositoryService) Fingerprint(repositoryPath string) (string, error) {
	if !IsGitRepository(repositoryPath) {
		return "", errors.New("not a Git repository")
	}
	statusCommand := exec.Command("git", "status", "--porcelain=v1", "-z", "--untracked-files=all")
	statusCommand.Dir = repositoryPath
	statusBytes, statusError := statusCommand.Output()
	if statusError != nil {
		return "", statusError
	}
	fingerprint := sha256.New()
	head, headError := RunGit(repositoryPath, "rev-parse", "--verify", "--quiet", "HEAD")
	if headError != nil && !isGitExitCode(headError, 1) {
		return "", headError
	}
	fingerprint.Write([]byte(head))
	fingerprint.Write(statusBytes)
	for _, statusEntry := range strings.Split(string(statusBytes), "\x00") {
		if len(statusEntry) < 4 {
			continue
		}
		relativePath := strings.TrimSpace(statusEntry[3:])
		targetPath, pathError := SafeRepositoryPath(repositoryPath, relativePath)
		if pathError != nil {
			continue
		}
		if fileInfo, statError := os.Stat(targetPath); statError == nil {
			fmt.Fprintf(fingerprint, "%s:%d:%d", relativePath, fileInfo.Size(), fileInfo.ModTime().UnixNano())
		}
	}
	return fmt.Sprintf("%x", fingerprint.Sum(nil)), nil
}

// OpenInEditor starts the configured editor without blocking Abduction.
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
func RunGit(repositoryPath string, arguments ...string) (string, error) {
	command := exec.Command("git", arguments...)
	command.Dir = repositoryPath
	outputBytes, commandError := command.CombinedOutput()
	if commandError != nil {
		message := strings.TrimSpace(string(outputBytes))
		if message == "" {
			message = commandError.Error()
		}
		return "", &GitCommandError{Arguments: append([]string(nil), arguments...), Output: message, Err: commandError}
	}
	return strings.TrimSpace(string(outputBytes)), nil
}

// RemoteIdentity extracts an owner, repository name, and browser URL from origin.
func RemoteIdentity(repositoryPath string) (string, string, string, error) {
	remoteOutput, remoteError := RunGit(repositoryPath, "remote", "get-url", "origin")
	if remoteError != nil {
		var gitError *GitCommandError
		if errors.As(remoteError, &gitError) && strings.Contains(gitError.Output, "No such remote 'origin'") {
			return "", "", "", ErrNoGitHubRemote
		}
		return "", "", "", remoteError
	}
	remote := strings.TrimSuffix(remoteOutput, ".git")
	normalized := strings.Replace(remote, "git@github.com:", "https://github.com/", 1)
	if !strings.HasPrefix(normalized, "https://github.com/") {
		return "", "", "", ErrNoGitHubRemote
	}
	pathParts := strings.Split(strings.TrimPrefix(normalized, "https://github.com/"), "/")
	if len(pathParts) < 2 {
		return "", "", "", ErrNoGitHubRemote
	}
	return pathParts[0], pathParts[1], "https://github.com/" + pathParts[0] + "/" + pathParts[1], nil
}

func isGitExitCode(commandError error, exitCode int) bool {
	var exitError *exec.ExitError
	return errors.As(commandError, &exitError) && exitError.ExitCode() == exitCode
}

// PlatformName returns a friendly operating-system name for diagnostics.
func PlatformName() string {
	platformNames := map[string]string{"linux": "Linux", "darwin": "macOS", "windows": "Windows"}
	if platformName := platformNames[runtime.GOOS]; platformName != "" {
		return platformName
	}
	return runtime.GOOS
}
