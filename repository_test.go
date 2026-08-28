package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// TestSafeRepositoryPathRejectsTraversal protects the desktop filesystem boundary.
func TestSafeRepositoryPathRejectsTraversal(testingContext *testing.T) {
	repositoryPath := testingContext.TempDir()
	if _, pathError := SafeRepositoryPath(repositoryPath, "../outside"); pathError == nil {
		testingContext.Fatal("expected repository traversal to be rejected")
	}
}

// TestDefaultWorkspacePrefersExistingConventions keeps first launch useful.
func TestDefaultWorkspacePrefersExistingConventions(testingContext *testing.T) {
	userHome := testingContext.TempDir()
	githubPath := filepath.Join(userHome, "Github")
	if makeError := os.Mkdir(githubPath, 0o755); makeError != nil {
		testingContext.Fatal(makeError)
	}
	if workspace := DefaultWorkspace(userHome); workspace != githubPath {
		testingContext.Fatalf("expected %s, received %s", githubPath, workspace)
	}
}

// TestFastRepositoryDiscoveryFindsDirectoriesAndWorktrees protects first boot.
func TestFastRepositoryDiscoveryFindsDirectoriesAndWorktrees(testingContext *testing.T) {
	workspacePath := testingContext.TempDir()
	for _, repositoryName := range []string{"standard", "worktree"} {
		repositoryPath := filepath.Join(workspacePath, repositoryName)
		if makeError := os.Mkdir(repositoryPath, 0o755); makeError != nil {
			testingContext.Fatal(makeError)
		}
		gitPath := filepath.Join(repositoryPath, ".git")
		if repositoryName == "standard" {
			if makeError := os.Mkdir(gitPath, 0o755); makeError != nil {
				testingContext.Fatal(makeError)
			}
		} else if writeError := os.WriteFile(gitPath, []byte("gitdir: /tmp/example\n"), 0o644); writeError != nil {
			testingContext.Fatal(writeError)
		}
	}
	service := NewRepositoryService(Config{Workspace: workspacePath})
	repositories, discoveryError := service.ListFast()
	if discoveryError != nil {
		testingContext.Fatal(discoveryError)
	}
	if len(repositories) != 2 || repositories[0].Name != "standard" || repositories[1].Name != "worktree" {
		testingContext.Fatalf("unexpected fast discovery result: %#v", repositories)
	}
}

// TestFastRepositoryDiscoveryReportsUnreadableWorkspace keeps setup actionable.
func TestFastRepositoryDiscoveryReportsUnreadableWorkspace(testingContext *testing.T) {
	service := NewRepositoryService(Config{Workspace: filepath.Join(testingContext.TempDir(), "missing")})
	if _, discoveryError := service.ListFast(); discoveryError == nil {
		testingContext.Fatal("expected missing workspace error")
	}
}

// TestDecodeGitHubStream protects complete organisation listings beyond 100 repos.
func TestDecodeGitHubStream(testingContext *testing.T) {
	stream := []byte("{\"name\":\"one\"}\n{\"name\":\"two\"}\n{\"name\":\"three\"}\n")
	repositories, decodeError := decodeGitHubStream[githubRepository](stream)
	if decodeError != nil {
		testingContext.Fatal(decodeError)
	}
	if len(repositories) != 3 || repositories[0].Name != "one" || repositories[2].Name != "three" {
		testingContext.Fatalf("unexpected paginated repositories: %#v", repositories)
	}
}

// TestRepositoryFingerprintChangesWithWorkingTree protects live UI refreshes.
func TestRepositoryFingerprintChangesWithWorkingTree(testingContext *testing.T) {
	repositoryPath := testingContext.TempDir()
	for _, commandArguments := range [][]string{{"init"}, {"config", "user.email", "refresh@example.test"}, {"config", "user.name", "Refresh Test"}} {
		command := exec.Command("git", commandArguments...)
		command.Dir = repositoryPath
		if outputBytes, commandError := command.CombinedOutput(); commandError != nil {
			testingContext.Fatalf("git setup failed: %s", outputBytes)
		}
	}
	filePath := filepath.Join(repositoryPath, "README.md")
	if writeError := os.WriteFile(filePath, []byte("one\n"), 0o644); writeError != nil {
		testingContext.Fatal(writeError)
	}
	service := NewRepositoryService(Config{})
	firstFingerprint, firstError := service.Fingerprint(repositoryPath)
	if firstError != nil {
		testingContext.Fatal(firstError)
	}
	if writeError := os.WriteFile(filePath, []byte("two is longer\n"), 0o644); writeError != nil {
		testingContext.Fatal(writeError)
	}
	secondFingerprint, secondError := service.Fingerprint(repositoryPath)
	if secondError != nil {
		testingContext.Fatal(secondError)
	}
	if firstFingerprint == secondFingerprint {
		testingContext.Fatal("expected working-tree edit to change repository fingerprint")
	}
}

// TestListDirectorySortsDirectoriesFirst keeps the file browser predictable.
func TestListDirectorySortsDirectoriesFirst(testingContext *testing.T) {
	repositoryPath := testingContext.TempDir()
	if makeError := os.Mkdir(filepath.Join(repositoryPath, ".git"), 0o755); makeError != nil {
		testingContext.Fatal(makeError)
	}
	if makeError := os.Mkdir(filepath.Join(repositoryPath, "source"), 0o755); makeError != nil {
		testingContext.Fatal(makeError)
	}
	if writeError := os.WriteFile(filepath.Join(repositoryPath, "README.md"), []byte("hello"), 0o644); writeError != nil {
		testingContext.Fatal(writeError)
	}
	service := NewRepositoryService(Config{})
	entries, listError := service.ListDirectory(repositoryPath, "")
	if listError != nil {
		testingContext.Fatal(listError)
	}
	if len(entries) != 2 || entries[0].Name != "source" || entries[0].Kind != "directory" {
		testingContext.Fatalf("unexpected directory order: %#v", entries)
	}
}

// TestRenderCodeEscapesSource ensures repository files cannot inject UI markup.
func TestRenderCodeEscapesSource(testingContext *testing.T) {
	document, renderError := RenderCode("example.html", "<script>alert('no')</script>", "catppuccin-mocha", 28)
	if renderError != nil {
		testingContext.Fatal(renderError)
	}
	if strings.Contains(document.HTML, "<script>") {
		testingContext.Fatal("highlighted source contained an executable script element")
	}
	if !strings.Contains(document.HTML, "&lt;") {
		testingContext.Fatal("expected source markup to be escaped")
	}
}

// TestMarkdownRouting keeps README rendering separate from syntax highlighting.
func TestMarkdownRouting(testingContext *testing.T) {
	if !IsMarkdown("docs/README.md") || !IsMarkdown("guide.markdown") || IsMarkdown("main.go") {
		testingContext.Fatal("markdown filename routing is incorrect")
	}
}

// TestCodexAnalysisCommandPinsReadOnlySandbox guards the provider's safety contract.
func TestCodexAnalysisCommandPinsReadOnlySandbox(testingContext *testing.T) {
	commandName, arguments, commandError := AnalysisCommand("codex", "/tmp/repository", "review this")
	if commandError != nil {
		testingContext.Fatal(commandError)
	}
	joinedArguments := strings.Join(arguments, " ")
	if commandName != "codex" || !strings.Contains(joinedArguments, "--sandbox read-only") {
		testingContext.Fatalf("unsafe Codex command: %s %s", commandName, joinedArguments)
	}
	if strings.Contains(joinedArguments, "dangerously-bypass") {
		testingContext.Fatal("Codex command bypassed its sandbox")
	}
}

// TestRepositorySearchReturnsTrackedMatches protects the explorer search contract.
func TestRepositorySearchReturnsTrackedMatches(testingContext *testing.T) {
	repositoryPath := testingContext.TempDir()
	commands := [][]string{{"init"}, {"config", "user.email", "reaper@example.test"}, {"config", "user.name", "Reaper Test"}}
	for _, arguments := range commands {
		command := exec.Command("git", arguments...)
		command.Dir = repositoryPath
		if outputBytes, commandError := command.CombinedOutput(); commandError != nil {
			testingContext.Fatalf("git setup failed: %s", outputBytes)
		}
	}
	if writeError := os.WriteFile(filepath.Join(repositoryPath, "main.go"), []byte("package main\n// harvest repositories\n"), 0o644); writeError != nil {
		testingContext.Fatal(writeError)
	}
	addCommand := exec.Command("git", "add", "main.go")
	addCommand.Dir = repositoryPath
	if outputBytes, addError := addCommand.CombinedOutput(); addError != nil {
		testingContext.Fatalf("git add failed: %s", outputBytes)
	}
	results, searchError := NewRepositoryService(Config{}).Search(repositoryPath, "harvest", 20)
	if searchError != nil {
		testingContext.Fatal(searchError)
	}
	if len(results) != 1 || results[0].Path != "main.go" || results[0].Line != 2 {
		testingContext.Fatalf("unexpected search results: %#v", results)
	}
}

// TestSearchFilesMatchesTrackedPaths verifies filename search sees nested files.
func TestSearchFilesMatchesTrackedPaths(testingContext *testing.T) {
	repositoryPath := testingContext.TempDir()
	commands := [][]string{{"init"}, {"config", "user.email", "test@example.com"}, {"config", "user.name", "Test User"}}
	for _, commandArguments := range commands {
		command := exec.Command("git", commandArguments...)
		command.Dir = repositoryPath
		if outputBytes, commandError := command.CombinedOutput(); commandError != nil {
			testingContext.Fatalf("git setup failed: %s", outputBytes)
		}
	}
	if makeError := os.MkdirAll(filepath.Join(repositoryPath, "internal", "search"), 0o755); makeError != nil {
		testingContext.Fatal(makeError)
	}
	trackedPath := filepath.Join(repositoryPath, "internal", "search", "matcher.go")
	if writeError := os.WriteFile(trackedPath, []byte("package search\n"), 0o644); writeError != nil {
		testingContext.Fatal(writeError)
	}
	addCommand := exec.Command("git", "add", ".")
	addCommand.Dir = repositoryPath
	if outputBytes, addError := addCommand.CombinedOutput(); addError != nil {
		testingContext.Fatalf("git add failed: %s", outputBytes)
	}
	results, searchError := NewRepositoryService(Config{}).SearchFiles(repositoryPath, "matcher", 20)
	if searchError != nil {
		testingContext.Fatal(searchError)
	}
	if len(results) != 1 || results[0].Path != "internal/search/matcher.go" || results[0].Kind != "file" {
		testingContext.Fatalf("unexpected filename results: %#v", results)
	}
}

func TestRegexSearchMatchesContentAndFilenames(testingContext *testing.T) {
	repositoryPath := testingContext.TempDir()
	for _, commandArguments := range [][]string{{"init"}, {"config", "user.email", "test@example.com"}, {"config", "user.name", "Test User"}} {
		command := exec.Command("git", commandArguments...)
		command.Dir = repositoryPath
		if outputBytes, commandError := command.CombinedOutput(); commandError != nil {
			testingContext.Fatalf("git setup failed: %s", outputBytes)
		}
	}
	if writeError := os.WriteFile(filepath.Join(repositoryPath, "flight_report.go"), []byte("package report\nconst object = \"tic tac\"\n"), 0o644); writeError != nil {
		testingContext.Fatal(writeError)
	}
	addCommand := exec.Command("git", "add", ".")
	addCommand.Dir = repositoryPath
	if outputBytes, addError := addCommand.CombinedOutput(); addError != nil {
		testingContext.Fatalf("git add failed: %s", outputBytes)
	}
	service := NewRepositoryService(Config{})
	contentResults, contentError := service.SearchPattern(repositoryPath, "tic[ -]tac|tic tac", 20, true)
	if contentError != nil || len(contentResults) != 1 {
		testingContext.Fatalf("unexpected regex content results: %#v, %v", contentResults, contentError)
	}
	fileResults, fileError := service.SearchFilesPattern(repositoryPath, "^flight_.*\\.go$", 20, true)
	if fileError != nil || len(fileResults) != 1 || fileResults[0].Path != "flight_report.go" {
		testingContext.Fatalf("unexpected regex filename results: %#v, %v", fileResults, fileError)
	}
	if _, invalidError := service.SearchFilesPattern(repositoryPath, "[", 20, true); invalidError == nil {
		testingContext.Fatal("invalid filename regex did not return an error")
	}
}
