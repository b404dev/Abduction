package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRepositoryListReportsMissingWorkspace(t *testing.T) {
	service := NewRepositoryService(Config{Workspace: filepath.Join(t.TempDir(), "missing")})
	if repositories, listError := service.List(); listError == nil || repositories != nil {
		t.Fatalf("expected list error, received repositories=%#v error=%v", repositories, listError)
	}
}

func TestRefreshReposReportsWorkspaceFailure(t *testing.T) {
	service := NewRepositoryService(Config{Workspace: filepath.Join(t.TempDir(), "missing")})
	app := NewApp()
	app.repository = service
	if repositories, refreshError := app.RefreshRepos(); refreshError == nil || repositories != nil {
		t.Fatalf("expected refresh error, received repositories=%#v error=%v", repositories, refreshError)
	}
}

func TestRunGitPreservesCommandFailure(t *testing.T) {
	repositoryPath := t.TempDir()
	_, commandError := RunGit(repositoryPath, "definitely-not-a-git-subcommand")
	if commandError == nil {
		t.Fatal("expected Git command failure")
	}
	var gitError *GitCommandError
	if !errors.As(commandError, &gitError) || gitError.Output == "" || !strings.Contains(commandError.Error(), "definitely-not-a-git-subcommand") {
		t.Fatalf("Git failure lost diagnostic context: %v", commandError)
	}
}

func TestStatsReportsMetadataCommandFailure(t *testing.T) {
	repositoryPath := t.TempDir()
	if makeError := os.Mkdir(filepath.Join(repositoryPath, ".git"), 0o755); makeError != nil {
		t.Fatal(makeError)
	}
	t.Setenv("PATH", "")
	if _, statsError := NewRepositoryService(Config{}).Stats(repositoryPath); statsError == nil {
		t.Fatal("expected metadata query failure")
	}
}

func TestLoadConfigReportsMalformedJSON(t *testing.T) {
	configRoot := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", configRoot)
	configDirectory := filepath.Join(configRoot, "reaper")
	if makeError := os.MkdirAll(configDirectory, 0o755); makeError != nil {
		t.Fatal(makeError)
	}
	if writeError := os.WriteFile(filepath.Join(configDirectory, "config.json"), []byte("{broken"), 0o600); writeError != nil {
		t.Fatal(writeError)
	}
	configuration, loadError := LoadConfig()
	if loadError == nil || configuration.Theme == "" {
		t.Fatalf("expected defaults plus a parse error, received %#v, %v", configuration, loadError)
	}
}

func TestLoadGitHubObjectPreservesEmptyOutputFailure(t *testing.T) {
	binDirectory := t.TempDir()
	ghPath := filepath.Join(binDirectory, "gh")
	if writeError := os.WriteFile(ghPath, []byte("#!/bin/sh\nexit 7\n"), 0o755); writeError != nil {
		t.Fatal(writeError)
	}
	t.Setenv("PATH", binDirectory)
	_, requestError := loadGitHubObject[githubContent]("repos/acme/example/contents/README.md")
	if requestError == nil || strings.HasSuffix(requestError.Error(), "GitHub request failed:") || !strings.Contains(requestError.Error(), "exit status 7") {
		t.Fatalf("request failure lost the command error: %v", requestError)
	}
}

func TestReadRemoteOverviewPropagatesNonMissingErrors(t *testing.T) {
	binDirectory := t.TempDir()
	ghPath := filepath.Join(binDirectory, "gh")
	if writeError := os.WriteFile(ghPath, []byte("#!/bin/sh\necho authentication failed >&2\nexit 1\n"), 0o755); writeError != nil {
		t.Fatal(writeError)
	}
	t.Setenv("PATH", binDirectory)
	app := NewApp()
	if _, overviewError := app.ReadRemoteOverview("acme/example", "main", "reaper-dark"); overviewError == nil || !strings.Contains(overviewError.Error(), "authentication failed") {
		t.Fatalf("expected remote API error, received %v", overviewError)
	}
}

func TestArchiveScanReportsWriteFailure(t *testing.T) {
	configRoot := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", configRoot)
	if writeError := os.WriteFile(filepath.Join(configRoot, "reaper"), []byte("not a directory"), 0o600); writeError != nil {
		t.Fatal(writeError)
	}
	if reportPath, archiveError := archiveScan(t.TempDir(), "gitleaks", []string{"result"}); archiveError == nil || reportPath != "" {
		t.Fatalf("expected archive error, received path=%q error=%v", reportPath, archiveError)
	}
}
