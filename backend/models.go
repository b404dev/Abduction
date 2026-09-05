package backend

// Config contains the small set of user-editable desktop preferences.
type Config struct {
	Workspace string  `json:"workspace"`
	Editor    string  `json:"editor"`
	Theme     string  `json:"theme"`
	Glow      float64 `json:"glow"`
	Radius    int     `json:"radius"`
	Glass     float64 `json:"glass"`
	Scale     float64 `json:"scale"`
}

// Bootstrap contains the initial application state returned in one call.
type Bootstrap struct {
	Config   Config `json:"config"`
	Repos    []Repo `json:"repos"`
	Tools    []Tool `json:"tools"`
	Platform string `json:"platform"`
	Version  string `json:"version"`
	Error    string `json:"error"`
}

// Repo describes a local Git checkout displayed in the repository picker.
type Repo struct {
	Name        string `json:"name"`
	Owner       string `json:"owner"`
	FullName    string `json:"fullName"`
	Path        string `json:"path"`
	Branch      string `json:"branch"`
	Language    string `json:"language"`
	Updated     string `json:"updated"`
	GitHubURL   string `json:"githubUrl"`
	Description string `json:"description"`
}

// GitIdentity describes the Git author identity active for a repository.
type GitIdentity struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// RepositorySources groups local and GitHub repositories for the picker.
type RepositorySources struct {
	Yours         []Repo `json:"yours"`
	Organisations []Repo `json:"organisations"`
	Starred       []Repo `json:"starred"`
	Error         string `json:"error"`
}

// TreeEntry describes one direct child in a repository directory.
type TreeEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Kind string `json:"kind"`
	Size int64  `json:"size"`
}

// SearchResult identifies one matching source line inside a repository.
type SearchResult struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Preview string `json:"preview"`
	Kind    string `json:"kind"`
}

// Document contains safe rendered HTML and the source metadata behind it.
type Document struct {
	Path     string `json:"path"`
	Name     string `json:"name"`
	Language string `json:"language"`
	HTML     string `json:"html"`
	Source   string `json:"source"`
	Size     int64  `json:"size"`
	Lines    int    `json:"lines"`
	Markdown bool   `json:"markdown"`
	Binary   bool   `json:"binary"`
}

// Commit describes one row in the repository history view.
type Commit struct {
	Hash       string   `json:"hash"`
	Short      string   `json:"short"`
	Subject    string   `json:"subject"`
	Author     string   `json:"author"`
	Date       string   `json:"date"`
	Graph      string   `json:"graph"`
	Connectors []string `json:"connectors"`
	Refs       string   `json:"refs"`
	Parents    []string `json:"parents"`
}

// LanguageStat summarizes tracked files belonging to one detected language.
type LanguageStat struct {
	Name    string  `json:"name"`
	Files   int     `json:"files"`
	Bytes   int64   `json:"bytes"`
	Percent float64 `json:"percent"`
}

// ContributorStat attributes repository commits to one Git identity.
type ContributorStat struct {
	Name    string  `json:"name"`
	Email   string  `json:"email"`
	Commits int     `json:"commits"`
	Percent float64 `json:"percent"`
}

// RepositoryStats contains high-level facts about one local checkout.
type RepositoryStats struct {
	Commits                int               `json:"commits"`
	Branches               int               `json:"branches"`
	Contributors           int               `json:"contributors"`
	Files                  int               `json:"files"`
	Lines                  int               `json:"lines"`
	Bytes                  int64             `json:"bytes"`
	FirstCommit            string            `json:"firstCommit"`
	LastCommit             string            `json:"lastCommit"`
	Languages              []LanguageStat    `json:"languages"`
	ContributorsByIdentity []ContributorStat `json:"contributorsByIdentity"`
}

// PullRequest describes a GitHub review item associated with a local checkout.
type PullRequest struct {
	Number     int    `json:"number"`
	Title      string `json:"title"`
	Author     string `json:"author"`
	State      string `json:"state"`
	Draft      bool   `json:"draft"`
	Updated    string `json:"updated"`
	URL        string `json:"url"`
	HeadBranch string `json:"headBranch"`
	BaseBranch string `json:"baseBranch"`
}

// PullRequestFile summarizes one file changed by a pull request.
type PullRequestFile struct {
	Path      string `json:"path"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

// PullRequestDetail contains the review metadata and patch shown in drill-down.
type PullRequestDetail struct {
	PullRequest
	Body           string            `json:"body"`
	Additions      int               `json:"additions"`
	Deletions      int               `json:"deletions"`
	ChangedFiles   int               `json:"changedFiles"`
	Commits        int               `json:"commits"`
	ReviewDecision string            `json:"reviewDecision"`
	Mergeable      string            `json:"mergeable"`
	Files          []PullRequestFile `json:"files"`
	Diff           string            `json:"diff"`
}

// Tool describes an optional executable used by Abduction integrations.
type Tool struct {
	Name      string           `json:"name"`
	Version   string           `json:"version"`
	Install   string           `json:"install"`
	Category  string           `json:"category"`
	Languages []string         `json:"languages"`
	Available bool             `json:"available"`
	Commands  []InstallCommand `json:"commands"`
}

// InstallCommand maps one host package manager to a copyable command.
type InstallCommand struct {
	Manager string `json:"manager"`
	Command string `json:"command"`
}

// AnalysisEvent is a streamed provider update delivered to the active view.
type AnalysisEvent struct {
	JobID      string `json:"jobId"`
	Provider   string `json:"provider"`
	Kind       string `json:"kind"`
	Text       string `json:"text"`
	ReportPath string `json:"reportPath"`
}

// ScannerInfo describes one supported security scanner and its host status.
type ScannerInfo struct {
	Name      string           `json:"name"`
	Available bool             `json:"available"`
	Install   string           `json:"install"`
	Commands  []InstallCommand `json:"commands"`
}

// LinterInfo describes an approved language tool and whether it is installed.
type LinterInfo struct {
	Name      string           `json:"name"`
	Available bool             `json:"available"`
	Install   string           `json:"install"`
	Commands  []InstallCommand `json:"commands"`
}

// LintDiagnostic is a normalized source location emitted by a linter.
type LintDiagnostic struct {
	Linter   string `json:"linter"`
	Path     string `json:"path"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
}

// LintReport retains both normalized diagnostics and the tool's original output.
type LintReport struct {
	Linter      string           `json:"linter"`
	Diagnostics []LintDiagnostic `json:"diagnostics"`
	Output      string           `json:"output"`
	Error       string           `json:"error"`
}

// ScanEvent is one streamed security job update.
type ScanEvent struct {
	JobID      string `json:"jobId"`
	Scanner    string `json:"scanner"`
	Kind       string `json:"kind"`
	Text       string `json:"text"`
	ReportPath string `json:"reportPath"`
}
