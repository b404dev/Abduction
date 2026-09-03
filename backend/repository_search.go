package backend

import (
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Search finds a bounded set of tracked text matches without invoking a shell.
func (service *RepositoryService) Search(repositoryPath string, query string, limit int) ([]SearchResult, error) {
	return service.SearchPattern(repositoryPath, query, limit, false)
}

// SearchPattern searches tracked file contents using either literal text or a regular expression.
func (service *RepositoryService) SearchPattern(repositoryPath string, query string, limit int, useRegex bool) ([]SearchResult, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("not a Git repository")
	}
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" || (!useRegex && len(trimmedQuery) < 2) {
		return []SearchResult{}, nil
	}
	if useRegex {
		if _, compileError := regexp.Compile(trimmedQuery); compileError != nil {
			return nil, fmt.Errorf("invalid regular expression: %w", compileError)
		}
	}
	commandArguments := []string{"grep", "-n", "-I", "--full-name"}
	if useRegex {
		commandArguments = append(commandArguments, "-E")
	}
	commandArguments = append(commandArguments, "-e", trimmedQuery, "--")
	gitBinary, lookupError := GitExecutable()
	if lookupError != nil {
		return nil, lookupError
	}
	command := exec.Command(gitBinary, commandArguments...)
	command.Dir = repositoryPath
	outputBytes, commandError := command.Output()
	if commandError != nil {
		var exitError *exec.ExitError
		if errors.As(commandError, &exitError) && exitError.ExitCode() == 1 {
			return []SearchResult{}, nil
		}
		return nil, commandError
	}
	results := make([]SearchResult, 0)
	for _, outputLine := range strings.Split(string(outputBytes), "\n") {
		matchParts := strings.SplitN(outputLine, ":", 3)
		if len(matchParts) != 3 {
			continue
		}
		lineNumber, conversionError := strconv.Atoi(matchParts[1])
		if conversionError != nil {
			continue
		}
		results = append(results, SearchResult{Path: matchParts[0], Line: lineNumber, Preview: strings.TrimSpace(matchParts[2]), Kind: "content"})
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

// SearchFiles finds tracked paths by filename or directory fragment.
func (service *RepositoryService) SearchFiles(repositoryPath string, query string, limit int) ([]SearchResult, error) {
	return service.SearchFilesPattern(repositoryPath, query, limit, false)
}

// SearchFilesPattern finds tracked paths using a literal fragment or regular expression.
func (service *RepositoryService) SearchFilesPattern(repositoryPath string, query string, limit int, useRegex bool) ([]SearchResult, error) {
	if !IsGitRepository(repositoryPath) {
		return nil, errors.New("not a Git repository")
	}
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" || (!useRegex && len(trimmedQuery) < 2) {
		return []SearchResult{}, nil
	}
	var pathPattern *regexp.Regexp
	if useRegex {
		compiledPattern, compileError := regexp.Compile("(?i)" + trimmedQuery)
		if compileError != nil {
			return nil, fmt.Errorf("invalid regular expression: %w", compileError)
		}
		pathPattern = compiledPattern
	} else {
		trimmedQuery = strings.ToLower(trimmedQuery)
	}
	gitBinary, lookupError := GitExecutable()
	if lookupError != nil {
		return nil, lookupError
	}
	command := exec.Command(gitBinary, "ls-files", "-z")
	command.Dir = repositoryPath
	outputBytes, commandError := command.Output()
	if commandError != nil {
		return nil, commandError
	}
	type rankedPath struct {
		path  string
		score int
	}
	rankedPaths := make([]rankedPath, 0)
	for _, trackedPath := range strings.Split(string(outputBytes), "\x00") {
		matches := pathPattern != nil && pathPattern.MatchString(trackedPath)
		score := 0
		if pathPattern == nil {
			score, matches = FuzzyPathScore(trackedPath, trimmedQuery)
		}
		if trackedPath == "" || !matches {
			continue
		}
		rankedPaths = append(rankedPaths, rankedPath{path: trackedPath, score: score})
	}
	if pathPattern == nil {
		sort.SliceStable(rankedPaths, func(leftIndex int, rightIndex int) bool {
			return rankedPaths[leftIndex].score < rankedPaths[rightIndex].score
		})
	}
	if len(rankedPaths) > limit {
		rankedPaths = rankedPaths[:limit]
	}
	results := make([]SearchResult, 0, len(rankedPaths))
	for _, ranked := range rankedPaths {
		results = append(results, SearchResult{Path: ranked.path, Preview: filepath.Dir(ranked.path), Kind: "file"})
	}
	return results, nil
}

// FuzzyPathScore matches query characters in order and favours tight,
// consecutive matches at path-component boundaries.
func FuzzyPathScore(candidate string, query string) (int, bool) {
	haystack := strings.ToLower(candidate)
	needle := strings.ToLower(strings.TrimSpace(query))
	if needle == "" {
		return 0, true
	}
	score := len(haystack) - len(needle)
	previousIndex := -2
	searchFrom := 0
	for _, character := range needle {
		matchOffset := strings.IndexRune(haystack[searchFrom:], character)
		if matchOffset < 0 {
			return 0, false
		}
		matchIndex := searchFrom + matchOffset
		score += matchIndex - searchFrom
		if matchIndex == previousIndex+1 {
			score -= 4
		}
		if matchIndex == 0 || strings.ContainsRune("/._- ", rune(haystack[matchIndex-1])) {
			score -= 6
		}
		previousIndex = matchIndex
		searchFrom = matchIndex + 1
	}
	return score, true
}
