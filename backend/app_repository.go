package backend

import (
	"errors"
	"fmt"
	"strings"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ListDirectory returns one safe, sorted level of a repository tree.
func (app *App) ListDirectory(repositoryPath string, relativePath string) ([]TreeEntry, error) {
	key := repositoryPath + "\x00" + relativePath
	return app.directories.Get(key, 10*time.Second, func() ([]TreeEntry, error) { return app.repository.ListDirectory(repositoryPath, relativePath) })
}

// SearchRepository returns tracked text matches for the explorer search panel.
func (app *App) SearchRepository(repositoryPath string, query string) ([]SearchResult, error) {
	return app.repository.Search(repositoryPath, query, 200)
}

// SearchRepositoryFiles returns tracked paths matching a filename fragment.
func (app *App) SearchRepositoryFiles(repositoryPath string, query string) ([]SearchResult, error) {
	return app.repository.SearchFiles(repositoryPath, query, 200)
}

// SearchRepositoryPattern returns tracked content matches with optional regex semantics.
func (app *App) SearchRepositoryPattern(repositoryPath string, query string, useRegex bool) ([]SearchResult, error) {
	return app.repository.SearchPattern(repositoryPath, query, 200, useRegex)
}

// SearchRepositoryFilesPattern returns tracked filename matches with optional regex semantics.
func (app *App) SearchRepositoryFilesPattern(repositoryPath string, query string, useRegex bool) ([]SearchResult, error) {
	return app.repository.SearchFilesPattern(repositoryPath, query, 200, useRegex)
}

// ReadOverview renders the repository README or a useful empty state.
func (app *App) ReadOverview(repositoryPath string, themeName string) (Document, error) {
	key := repositoryPath + "\x00overview\x00" + themeName
	return app.documents.Get(key, 10*time.Second, func() (Document, error) { return app.code.ReadOverview(repositoryPath, themeName) })
}

// ReadFile returns syntax-highlighted HTML for a repository file.
func (app *App) ReadFile(repositoryPath string, relativePath string, themeName string) (Document, error) {
	key := repositoryPath + "\x00" + relativePath + "\x00" + themeName
	return app.documents.Get(key, 10*time.Second, func() (Document, error) { return app.code.ReadFile(repositoryPath, relativePath, themeName) })
}

func (app *App) ListRemoteDirectory(fullName string, relativePath string, branch string) ([]TreeEntry, error) {
	return app.repository.RemoteDirectory(fullName, relativePath, branch)
}

func (app *App) RemoteBranches(fullName string) ([]string, error) {
	return app.repository.RemoteBranches(fullName)
}

func (app *App) PreloadRemoteRepository(fullName string, branch string) (int, error) {
	return app.repository.PreloadRemoteRepository(fullName, branch)
}

func (app *App) ReadRemoteFile(fullName string, relativePath string, branch string, themeName string) (Document, error) {
	sourceBytes, readError := app.repository.RemoteFile(fullName, relativePath, branch)
	if readError != nil {
		return Document{}, readError
	}
	return app.code.RenderSource(relativePath, sourceBytes, themeName)
}

func (app *App) ReadRemoteOverview(fullName string, branch string, themeName string) (Document, error) {
	for _, readmeName := range []string{"README.md", "readme.md", "README.markdown", "README"} {
		document, readError := app.ReadRemoteFile(fullName, readmeName, branch, themeName)
		if readError == nil {
			return document, nil
		}
		if !isRemoteFileNotFound(readError) {
			return Document{}, fmt.Errorf("read remote overview: %w", readError)
		}
	}
	return app.code.RenderSource("README.md", []byte("# No README found\n\nChoose a file from the remote tree."), themeName)
}

// Commits returns the repository's recent commit history.
func (app *App) Commits(repositoryPath string) ([]Commit, error) {
	return app.commits.Get(repositoryPath, 15*time.Second, func() ([]Commit, error) { return app.repository.Commits(repositoryPath, 100) })
}

// RepositoryStats returns tracked-file and all-ref repository measurements.
func (app *App) RepositoryStats(repositoryPath string) (RepositoryStats, error) {
	return app.statistics.Get(repositoryPath, 60*time.Second, func() (RepositoryStats, error) { return app.repository.Stats(repositoryPath) })
}

// PullRequests returns GitHub review items for the active repository.
func (app *App) PullRequests(repositoryPath string) ([]PullRequest, error) {
	return app.pullRequests.Get(repositoryPath, 60*time.Second, func() ([]PullRequest, error) { return app.repository.PullRequests(repositoryPath) })
}

// PullRequestDetail returns metadata and a unified patch for one review item.
func (app *App) PullRequestDetail(repositoryPath string, number int) (PullRequestDetail, error) {
	return app.repository.PullRequestDetail(repositoryPath, number)
}

// OpenURL opens a validated HTTPS address in the host browser.
func (app *App) OpenURL(address string) error {
	if !strings.HasPrefix(address, "https://") {
		return errors.New("only HTTPS links can be opened")
	}
	wailsruntime.BrowserOpenURL(app.context, address)
	return nil
}

// Branches returns local and remote branches without duplicate names.
func (app *App) Branches(repositoryPath string) ([]string, error) {
	return app.branches.Get(repositoryPath, 15*time.Second, func() ([]string, error) { return app.repository.Branches(repositoryPath) })
}

// SwitchBranch safely checks out a known branch and returns its resolved name.
func (app *App) SwitchBranch(repositoryPath string, branch string) (string, error) {
	resolvedBranch, switchError := app.repository.SwitchBranch(repositoryPath, branch)
	if switchError == nil {
		app.invalidateRepository(repositoryPath)
		app.repositories.Clear()
	}
	return resolvedBranch, switchError
}

// PullLatest fast-forwards a local repository and invalidates derived views.
func (app *App) PullLatest(repositoryPath string) (string, error) {
	output, pullError := app.repository.PullLatest(repositoryPath)
	if pullError == nil {
		app.invalidateRepository(repositoryPath)
		app.repositories.Clear()
	}
	return output, pullError
}

// RepositoryFingerprint lets the UI detect commits and working-tree changes.
func (app *App) RepositoryFingerprint(repositoryPath string) (string, error) {
	return app.repository.Fingerprint(repositoryPath)
}

// RefreshRepository clears cached data before a manual or automatic reload.
func (app *App) RefreshRepository(repositoryPath string) {
	app.invalidateRepository(repositoryPath)
}

// invalidateRepository removes data made stale by a branch or working-tree transition.
func (app *App) invalidateRepository(repositoryPath string) {
	app.commits.Delete(repositoryPath)
	app.statistics.Delete(repositoryPath)
	app.pullRequests.Delete(repositoryPath)
	app.branches.Delete(repositoryPath)
	app.directories.Clear()
	app.documents.Clear()
}

// clearRepositoryCaches resets all data owned by the configured workspace.
func (app *App) clearRepositoryCaches() {
	app.directories.Clear()
	app.documents.Clear()
	app.commits.Clear()
	app.statistics.Clear()
	app.pullRequests.Clear()
	app.branches.Clear()
}

// OpenInEditor opens a repository or file using the configured editor.
func (app *App) OpenInEditor(repositoryPath string, relativePath string) error {
	return app.repository.OpenInEditor(repositoryPath, relativePath)
}

// OpenRepositoryOnGitHub opens the repository's validated GitHub URL.
func (app *App) OpenRepositoryOnGitHub(repository Repo) error {
	if repository.GitHubURL == "" {
		return ErrNoGitHubRemote
	}
	wailsruntime.BrowserOpenURL(app.context, repository.GitHubURL)
	return nil
}
