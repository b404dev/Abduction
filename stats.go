package main

import (
	"bytes"
	"errors"
	"os"
	"os/exec"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
)

type measuredFile struct {
	language string
	bytes    int64
	lines    int
}

// Stats measures tracked repository content and all-ref Git activity.
func (service *RepositoryService) Stats(repositoryPath string) (RepositoryStats, error) {
	if !IsGitRepository(repositoryPath) {
		return RepositoryStats{}, errors.New("not a Git repository")
	}
	statistics := RepositoryStats{}
	var contributorOutput string
	var branches []string
	var branchError error
	var metadataWaitGroup sync.WaitGroup
	metadataWaitGroup.Add(5)
	go func() {
		defer metadataWaitGroup.Done()
		statistics.Commits = parseGitCount(RunGit(repositoryPath, "rev-list", "--all", "--count"))
	}()
	go func() {
		defer metadataWaitGroup.Done()
		statistics.FirstCommit = RunGit(repositoryPath, "log", "--all", "--reverse", "--format=%aI", "-1")
	}()
	go func() {
		defer metadataWaitGroup.Done()
		statistics.LastCommit = RunGit(repositoryPath, "log", "--all", "--format=%aI", "-1")
	}()
	go func() {
		defer metadataWaitGroup.Done()
		contributorOutput = RunGit(repositoryPath, "shortlog", "-sne", "--all")
	}()
	go func() { defer metadataWaitGroup.Done(); branches, branchError = service.Branches(repositoryPath) }()
	metadataWaitGroup.Wait()
	statistics.ContributorsByIdentity = parseContributors(contributorOutput, statistics.Commits)
	statistics.Contributors = len(statistics.ContributorsByIdentity)
	if branchError == nil {
		statistics.Branches = len(branches)
	}
	trackedCommand := exec.Command("git", "ls-files", "-z")
	trackedCommand.Dir = repositoryPath
	trackedBytes, trackedError := trackedCommand.Output()
	if trackedError != nil {
		return RepositoryStats{}, trackedError
	}
	trackedNames := strings.Split(string(trackedBytes), "\x00")
	fileJobs := make(chan string)
	fileResults := make(chan measuredFile)
	workerCount := min(max(runtime.NumCPU()/2, 2), 8)
	var fileWaitGroup sync.WaitGroup
	for workerIndex := 0; workerIndex < workerCount; workerIndex++ {
		fileWaitGroup.Add(1)
		go func() {
			defer fileWaitGroup.Done()
			for trackedName := range fileJobs {
				filePath, pathError := SafeRepositoryPath(repositoryPath, trackedName)
				if pathError != nil {
					continue
				}
				fileInfo, statError := os.Stat(filePath)
				if statError != nil || fileInfo.IsDir() {
					continue
				}
				result := measuredFile{language: LanguageForPath(trackedName), bytes: fileInfo.Size()}
				if fileInfo.Size() <= 2*1024*1024 {
					fileBytes, readError := os.ReadFile(filePath)
					if readError == nil && !bytes.Contains(fileBytes, []byte{0}) {
						result.lines = CountLines(string(fileBytes))
					}
				}
				fileResults <- result
			}
		}()
	}
	go func() {
		for _, trackedName := range trackedNames {
			if trackedName != "" {
				fileJobs <- trackedName
			}
		}
		close(fileJobs)
		fileWaitGroup.Wait()
		close(fileResults)
	}()
	languageTotals := make(map[string]*LanguageStat)
	for result := range fileResults {
		statistics.Files++
		statistics.Bytes += result.bytes
		statistics.Lines += result.lines
		languageTotal := languageTotals[result.language]
		if languageTotal == nil {
			languageTotal = &LanguageStat{Name: result.language}
			languageTotals[result.language] = languageTotal
		}
		languageTotal.Files++
		languageTotal.Bytes += result.bytes
	}
	statistics.Languages = make([]LanguageStat, 0, len(languageTotals))
	for _, languageTotal := range languageTotals {
		if statistics.Bytes > 0 {
			languageTotal.Percent = float64(languageTotal.Bytes) / float64(statistics.Bytes) * 100
		}
		statistics.Languages = append(statistics.Languages, *languageTotal)
	}
	sort.Slice(statistics.Languages, func(leftIndex int, rightIndex int) bool {
		return statistics.Languages[leftIndex].Bytes > statistics.Languages[rightIndex].Bytes
	})
	return statistics, nil
}

// parseContributors converts Git shortlog rows into display-ready identities.
func parseContributors(shortlogOutput string, totalCommits int) []ContributorStat {
	contributors := make([]ContributorStat, 0)
	for _, shortlogLine := range strings.Split(shortlogOutput, "\n") {
		fields := strings.Fields(strings.TrimSpace(shortlogLine))
		if len(fields) < 2 {
			continue
		}
		commitCount, parseError := strconv.Atoi(fields[0])
		if parseError != nil {
			continue
		}
		identity := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(shortlogLine), fields[0]))
		email := ""
		name := identity
		openingBracket := strings.LastIndex(identity, "<")
		if openingBracket >= 0 && strings.HasSuffix(identity, ">") {
			email = strings.TrimSuffix(identity[openingBracket+1:], ">")
			name = strings.TrimSpace(identity[:openingBracket])
		}
		percentage := 0.0
		if totalCommits > 0 {
			percentage = float64(commitCount) / float64(totalCommits) * 100
		}
		contributors = append(contributors, ContributorStat{Name: name, Email: email, Commits: commitCount, Percent: percentage})
	}
	return contributors
}

// parseGitCount converts a Git count while treating unavailable data as zero.
func parseGitCount(value string) int {
	parsedValue, parseError := strconv.Atoi(strings.TrimSpace(value))
	if parseError != nil {
		return 0
	}
	return parsedValue
}
