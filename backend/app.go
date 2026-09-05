package backend

import (
	"context"
	"path/filepath"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// version is overridden from the Git tag in release builds.
var version = "0.1.20"

// App is the narrow desktop bridge exposed to the web interface.
type App struct {
	context       context.Context
	repository    *RepositoryService
	code          *CodeService
	analysis      *AnalysisService
	security      *SecurityService
	configuration Config
	configError   error
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
	configuration, configError := LoadConfig()
	return &App{
		repository:    NewRepositoryService(configuration),
		code:          NewCodeService(),
		analysis:      NewAnalysisService(),
		security:      NewSecurityService(),
		configuration: configuration,
		configError:   configError,
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

// Startup stores the Wails runtime context needed by native desktop actions.
func (app *App) Startup(runtimeContext context.Context) {
	app.context = runtimeContext
}

// Bootstrap returns everything required to paint the first useful screen.
func (app *App) Bootstrap() Bootstrap {
	type repositoryResult struct {
		repositories []Repo
		err          error
	}
	repositoryResults := make(chan repositoryResult, 1)
	toolResults := make(chan []Tool, 1)
	go func() {
		repositories, repositoryError := app.repositories.Get("workspace-fast", 30*time.Second, app.repository.ListFast)
		repositoryResults <- repositoryResult{repositories: repositories, err: repositoryError}
	}()
	go func() {
		tools, _ := app.tools.Get("host", 24*time.Hour, func() ([]Tool, error) { return DetectTools(), nil })
		toolResults <- tools
	}()
	var repositories []Repo
	var tools []Tool
	var bootstrapError string
	if app.configError != nil {
		bootstrapError = app.configError.Error()
	}
	startupTimer := time.NewTimer(2500 * time.Millisecond)
	defer startupTimer.Stop()
	for repositories == nil || tools == nil {
		select {
		case result := <-repositoryResults:
			repositories = result.repositories
			if result.err != nil {
				if bootstrapError != "" {
					bootstrapError += "; "
				}
				bootstrapError += result.err.Error()
			}
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
		Error:    bootstrapError,
	}
}

// UpdateConfig persists preferences and refreshes dependent services.
func (app *App) UpdateConfig(configuration Config) (Bootstrap, error) {
	savedConfiguration, saveError := SaveConfig(configuration)
	if saveError != nil {
		return Bootstrap{}, saveError
	}
	app.configuration = savedConfiguration
	app.configError = nil
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
func (app *App) RefreshRepos() ([]Repo, error) {
	app.repositories.Clear()
	return app.repositories.Get("workspace", 30*time.Second, app.repository.List)
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
