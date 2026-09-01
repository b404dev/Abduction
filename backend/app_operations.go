package backend

import "time"

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
