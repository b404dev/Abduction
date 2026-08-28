package main

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// version is overridden from the Git tag in release builds.
var version = "0.1.1"

// App is the narrow desktop bridge exposed to the web interface.
type App struct {
	context       context.Context
	repository    *RepositoryService
	code          *CodeService
	analysis      *AnalysisService
	security      *SecurityService
	configuration Config
	repositories  *memoryCache[[]Repo]
	tools         *memoryCache[[]Tool]
	directories   *memoryCache[[]TreeEntry]
	documents     *memoryCache[Document]
	commits       *memoryCache[[]Commit]
	statistics    *memoryCache[RepositoryStats]
	pullRequests  *memoryCache[[]PullRequest]
	branches      *memoryCache[[]string]
	scanners      *memoryCache[[]ScannerInfo]
}

// NewApp builds the desktop bridge with its independent application services.
func NewApp() *App {
	configuration := LoadConfig()
	return &App{
		repository:    NewRepositoryService(configuration),
		code:          NewCodeService(),
		analysis:      NewAnalysisService(),
		security:      NewSecurityService(),
		configuration: configuration,
		repositories:  newMemoryCache[[]Repo](),
		tools:         newMemoryCache[[]Tool](),
		directories:   newMemoryCache[[]TreeEntry](),
		documents:     newMemoryCache[Document](),
		commits:       newMemoryCache[[]Commit](),
		statistics:    newMemoryCache[RepositoryStats](),
		pullRequests:  newMemoryCache[[]PullRequest](),
		branches:      newMemoryCache[[]string](),
		scanners:      newMemoryCache[[]ScannerInfo](),
	}
}

// Scanners returns the security tools Abduction knows how to run safely.
func (app *App) Scanners() []ScannerInfo {
	result, _ := app.scanners.Get("host", 24*time.Hour, func() ([]ScannerInfo, error) { return app.security.Scanners(), nil })
	return result
}

// StartScan launches one scanner against the selected local repository.
func (app *App) StartScan(repositoryPath string, scannerName string) (string, error) {
	return app.security.Start(app.context, repositoryPath, scannerName)
}

// CancelScan terminates one active scanner process.
func (app *App) CancelScan(jobID string) error { return app.security.Cancel(jobID) }

// Linters reports approved tools compatible with the current file language.
func (app *App) Linters(language string) []LinterInfo { return Linters(language) }

// RunLinters checks the current file with the user's selected approved tools.
func (app *App) RunLinters(repositoryPath string, relativePath string, language string, names []string) ([]LintReport, error) {
	return RunLinters(repositoryPath, relativePath, language, names)
}

// StartAnalysis runs a read-only Claude or Codex analysis in the repository.
func (app *App) StartAnalysis(repositoryPath string, provider string, prompt string) (string, error) {
	return app.analysis.Start(app.context, repositoryPath, provider, prompt)
}

// CancelAnalysis stops one active analysis process by its job identifier.
func (app *App) CancelAnalysis(jobID string) error {
	return app.analysis.Cancel(jobID)
}

// startup stores the Wails runtime context needed by native desktop actions.
func (app *App) startup(runtimeContext context.Context) {
	app.context = runtimeContext
}

// Bootstrap returns everything required to paint the first useful screen.
func (app *App) Bootstrap() Bootstrap {
	repositoryResults := make(chan []Repo, 1)
	toolResults := make(chan []Tool, 1)
	go func() {
		repositories, _ := app.repositories.Get("workspace", 30*time.Second, func() ([]Repo, error) { return app.repository.List(), nil })
		repositoryResults <- repositories
	}()
	go func() {
		tools, _ := app.tools.Get("host", 24*time.Hour, func() ([]Tool, error) { return DetectTools(), nil })
		toolResults <- tools
	}()
	var repositories []Repo
	var tools []Tool
	startupTimer := time.NewTimer(2500 * time.Millisecond)
	defer startupTimer.Stop()
	for repositories == nil || tools == nil {
		select {
		case repositories = <-repositoryResults:
			if len(repositories) == 0 {
				select {
				case tools = <-toolResults:
				default:
					tools = []Tool{}
				}
			}
		case tools = <-toolResults:
		case <-startupTimer.C:
			if repositories == nil {
				repositories = []Repo{}
			}
			if tools == nil {
				tools = []Tool{}
			}
		}
	}
	return Bootstrap{
		Config:   app.configuration,
		Repos:    repositories,
		Tools:    tools,
		Platform: PlatformName(),
		Version:  version,
	}
}

// UpdateConfig persists preferences and refreshes dependent services.
func (app *App) UpdateConfig(configuration Config) (Bootstrap, error) {
	savedConfiguration, saveError := SaveConfig(configuration)
	if saveError != nil {
		return Bootstrap{}, saveError
	}
	app.configuration = savedConfiguration
	app.repository = NewRepositoryService(savedConfiguration)
	app.clearRepositoryCaches()
	app.repositories.Clear()
	return app.Bootstrap(), nil
}

// ConfigPath returns the JSON file edited by the Settings workspace.
func (app *App) ConfigPath() string {
	return filepath.Join(ConfigDirectory(), "config.json")
}

// SelectWorkspace opens the platform folder picker at the current workspace.
func (app *App) SelectWorkspace() (string, error) {
	return wailsruntime.OpenDirectoryDialog(app.context, wailsruntime.OpenDialogOptions{
		Title:            "Choose a repository workspace",
		DefaultDirectory: app.configuration.Workspace,
	})
}

// RefreshRepos rescans the configured workspace for Git repositories.
func (app *App) RefreshRepos() []Repo {
	app.repositories.Clear()
	repositories, _ := app.repositories.Get("workspace", 30*time.Second, func() ([]Repo, error) { return app.repository.List(), nil })
	return repositories
}

// RepositorySources returns the authenticated user's grouped local and GitHub repositories.
func (app *App) RepositorySources() RepositorySources {
	return app.repository.Sources()
}

// CloneRepository clones a URL into the configured workspace and returns it.
func (app *App) CloneRepository(repositoryURL string) (Repo, error) {
	repository, cloneError := app.repository.Clone(repositoryURL)
	if cloneError == nil {
		app.repositories.Clear()
	}
	return repository, cloneError
}

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
