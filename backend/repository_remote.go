package backend

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

type githubRepository struct {
	Name          string `json:"name"`
	FullName      string `json:"full_name"`
	Description   string `json:"description"`
	HTMLURL       string `json:"html_url"`
	Language      string `json:"language"`
	PushedAt      string `json:"pushed_at"`
	DefaultBranch string `json:"default_branch"`
	Owner         struct {
		Login string `json:"login"`
		Type  string `json:"type"`
	} `json:"owner"`
}

type githubOrganisation struct {
	Login string `json:"login"`
}

type githubContent struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
}

type githubBranch struct {
	Name string `json:"name"`
}

// RemoteBranches lists every branch available to the authenticated viewer.
func (service *RepositoryService) RemoteBranches(fullName string) ([]string, error) {
	if !regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`).MatchString(fullName) {
		return nil, errors.New("invalid GitHub repository name")
	}
	remoteBranches, branchError := loadGitHubPages[githubBranch]("repos/" + fullName + "/branches?per_page=100")
	if branchError != nil {
		return nil, branchError
	}
	branches := make([]string, 0, len(remoteBranches))
	for _, branch := range remoteBranches {
		branches = append(branches, branch.Name)
	}
	return branches, nil
}

func loadGitHubObject[T any](endpoint string) (T, error) {
	var result T
	githubPath, lookupError := ExecutablePath("gh")
	if lookupError != nil {
		return result, lookupError
	}
	requestContext, cancelRequest := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelRequest()
	outputBytes, commandError := exec.CommandContext(requestContext, githubPath, "api", endpoint).CombinedOutput()
	if commandError != nil {
		if errors.Is(requestContext.Err(), context.DeadlineExceeded) {
			return result, fmt.Errorf("GitHub request timed out after 15 seconds: %w", requestContext.Err())
		}
		message := strings.TrimSpace(string(outputBytes))
		if message == "" {
			message = commandError.Error()
		}
		if strings.Contains(strings.ToLower(message), "http 404") {
			return result, fmt.Errorf("%w: %s", ErrRemoteFileNotFound, message)
		}
		return result, fmt.Errorf("GitHub request failed: %s: %w", message, commandError)
	}
	return result, json.Unmarshal(outputBytes, &result)
}

func remoteContentsEndpoint(fullName string, relativePath string, branch string) (string, error) {
	if !regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`).MatchString(fullName) {
		return "", errors.New("invalid GitHub repository name")
	}
	cleanPath := strings.Trim(strings.ReplaceAll(filepath.ToSlash(relativePath), "../", ""), "/")
	endpoint := "repos/" + fullName + "/contents"
	if cleanPath != "" {
		segments := strings.Split(cleanPath, "/")
		for index := range segments {
			segments[index] = url.PathEscape(segments[index])
		}
		endpoint += "/" + strings.Join(segments, "/")
	}
	if branch != "" {
		endpoint += "?ref=" + url.QueryEscape(branch)
	}
	return endpoint, nil
}

// PreloadRemoteRepository downloads one branch archive into a read-only memory cache.
func (service *RepositoryService) PreloadRemoteRepository(fullName string, branch string) (int, error) {
	if _, validationError := remoteContentsEndpoint(fullName, "", ""); validationError != nil {
		return 0, validationError
	}
	cacheKey := fullName + "\x00" + branch
	service.remoteMutex.RLock()
	existing := service.remoteSnapshots[cacheKey]
	service.remoteMutex.RUnlock()
	if existing != nil {
		return len(existing), nil
	}
	githubPath, lookupError := ExecutablePath("gh")
	if lookupError != nil {
		return 0, lookupError
	}
	requestContext, cancelRequest := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancelRequest()
	endpoint := "repos/" + fullName + "/tarball"
	if branch != "" {
		endpoint += "/" + url.PathEscape(branch)
	}
	archiveBytes, archiveError := exec.CommandContext(requestContext, githubPath, "api", endpoint).Output()
	if archiveError != nil {
		return 0, fmt.Errorf("remote repository download failed: %w", archiveError)
	}
	gzipReader, gzipError := gzip.NewReader(bytes.NewReader(archiveBytes))
	if gzipError != nil {
		return 0, gzipError
	}
	defer gzipReader.Close()
	files, totalBytes := make(map[string][]byte), int64(0)
	tarReader := tar.NewReader(gzipReader)
	for {
		header, nextError := tarReader.Next()
		if errors.Is(nextError, io.EOF) {
			break
		}
		if nextError != nil {
			return 0, nextError
		}
		if header.Typeflag != tar.TypeReg || header.Size > maximumReadableFileSize {
			continue
		}
		pathParts := strings.SplitN(filepath.ToSlash(header.Name), "/", 2)
		if len(pathParts) != 2 || pathParts[1] == "" {
			continue
		}
		totalBytes += header.Size
		if totalBytes > 256*1024*1024 {
			return 0, errors.New("remote repository exceeds the 256 MB viewer cache limit")
		}
		fileBytes := make([]byte, header.Size)
		if _, readError := io.ReadFull(tarReader, fileBytes); readError != nil {
			return 0, readError
		}
		files[pathParts[1]] = fileBytes
	}
	service.remoteMutex.Lock()
	service.remoteSnapshots[cacheKey] = files
	service.remoteMutex.Unlock()
	return len(files), nil
}

func (service *RepositoryService) remoteSnapshot(fullName string, branch string) map[string][]byte {
	service.remoteMutex.RLock()
	defer service.remoteMutex.RUnlock()
	return service.remoteSnapshots[fullName+"\x00"+branch]
}

// RemoteDirectory lists one GitHub directory without creating a checkout.
func (service *RepositoryService) RemoteDirectory(fullName string, relativePath string, branch string) ([]TreeEntry, error) {
	if snapshot := service.remoteSnapshot(fullName, branch); snapshot != nil {
		prefix := strings.Trim(filepath.ToSlash(relativePath), "/")
		if prefix != "" {
			prefix += "/"
		}
		seen := make(map[string]TreeEntry)
		for filePath, fileBytes := range snapshot {
			if !strings.HasPrefix(filePath, prefix) {
				continue
			}
			remainder := strings.TrimPrefix(filePath, prefix)
			parts := strings.SplitN(remainder, "/", 2)
			kind, size := "file", int64(len(fileBytes))
			if len(parts) == 2 {
				kind, size = "directory", 0
			}
			seen[parts[0]] = TreeEntry{Name: parts[0], Path: strings.TrimSuffix(prefix+parts[0], "/"), Kind: kind, Size: size}
		}
		entries := make([]TreeEntry, 0, len(seen))
		for _, entry := range seen {
			entries = append(entries, entry)
		}
		sort.Slice(entries, func(i, j int) bool {
			if entries[i].Kind != entries[j].Kind {
				return entries[i].Kind == "directory"
			}
			return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
		})
		return entries, nil
	}
	endpoint, endpointError := remoteContentsEndpoint(fullName, relativePath, branch)
	if endpointError != nil {
		return nil, endpointError
	}
	contents, contentError := loadGitHubObject[[]githubContent](endpoint)
	if contentError != nil {
		return nil, contentError
	}
	entries := make([]TreeEntry, 0, len(contents))
	for _, content := range contents {
		kind := "file"
		if content.Type == "dir" {
			kind = "directory"
		}
		entries = append(entries, TreeEntry{Name: content.Name, Path: content.Path, Kind: kind, Size: content.Size})
	}
	sort.Slice(entries, func(leftIndex int, rightIndex int) bool {
		if entries[leftIndex].Kind != entries[rightIndex].Kind {
			return entries[leftIndex].Kind == "directory"
		}
		return strings.ToLower(entries[leftIndex].Name) < strings.ToLower(entries[rightIndex].Name)
	})
	return entries, nil
}

// RemoteFile downloads one GitHub file through the authenticated API.
func (service *RepositoryService) RemoteFile(fullName string, relativePath string, branch string) ([]byte, error) {
	if snapshot := service.remoteSnapshot(fullName, branch); snapshot != nil {
		fileBytes, found := snapshot[strings.Trim(filepath.ToSlash(relativePath), "/")]
		if !found {
			return nil, fmt.Errorf("%w in the loaded repository", ErrRemoteFileNotFound)
		}
		return fileBytes, nil
	}
	endpoint, endpointError := remoteContentsEndpoint(fullName, relativePath, branch)
	if endpointError != nil {
		return nil, endpointError
	}
	content, contentError := loadGitHubObject[githubContent](endpoint)
	if contentError != nil {
		return nil, contentError
	}
	if content.Encoding != "base64" {
		return nil, errors.New("GitHub returned an unsupported file encoding")
	}
	return base64.StdEncoding.DecodeString(strings.ReplaceAll(content.Content, "\n", ""))
}

func isRemoteFileNotFound(readError error) bool {
	return errors.Is(readError, ErrRemoteFileNotFound)
}

// loadGitHubPages asks gh to follow every REST page and emits a compatible
// object stream instead of relying on the newer --slurp option.
func loadGitHubPages[T any](endpoint string) ([]T, error) {
	githubPath, lookupError := ExecutablePath("gh")
	if lookupError != nil {
		return nil, errors.New("GitHub CLI was not found (checked PATH, /opt/homebrew/bin, and /usr/local/bin)")
	}
	requestContext, cancelRequest := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelRequest()
	outputBytes, commandError := exec.CommandContext(requestContext, githubPath, "api", "--paginate", "--jq", ".[]", endpoint).CombinedOutput()
	if commandError != nil {
		if errors.Is(requestContext.Err(), context.DeadlineExceeded) {
			return nil, errors.New("GitHub request timed out after 15 seconds")
		}
		message := strings.TrimSpace(string(outputBytes))
		if message == "" {
			message = commandError.Error()
		}
		return nil, errors.New(message)
	}
	return decodeGitHubStream[T](outputBytes)
}

func decodeGitHubStream[T any](outputBytes []byte) ([]T, error) {
	decoder := json.NewDecoder(strings.NewReader(string(outputBytes)))
	items := make([]T, 0)
	for {
		var item T
		decodeError := decoder.Decode(&item)
		if errors.Is(decodeError, io.EOF) {
			break
		}
		if decodeError != nil {
			return nil, decodeError
		}
		items = append(items, item)
	}
	return items, nil
}

// Sources groups local checkouts with the authenticated user's GitHub sources.
func (service *RepositoryService) Sources() RepositorySources {
	localRepositories, localError := service.ListFast()
	if localError != nil {
		localRepositories = []Repo{}
	}
	result := RepositorySources{Yours: localRepositories, Organisations: []Repo{}, Starred: []Repo{}}
	githubPath, lookupError := ExecutablePath("gh")
	if lookupError != nil {
		result.Error = "GitHub CLI was not found. Install it with brew install gh, then reopen Abduction."
		return result
	}
	if loginBytes, loginError := exec.Command(githubPath, "api", "user", "--jq", ".login").CombinedOutput(); loginError != nil {
		message := strings.TrimSpace(string(loginBytes))
		if message == "" {
			message = "run gh auth login in Terminal"
		}
		result.Error = "GitHub authentication failed: " + message
		return result
	}
	localByName := make(map[string]Repo)
	for _, repository := range localRepositories {
		localByName[strings.ToLower(repository.FullName)] = repository
	}
	toRepo := func(remote githubRepository) Repo {
		if local, found := localByName[strings.ToLower(remote.FullName)]; found {
			local.Description = remote.Description
			return local
		}
		return Repo{Name: remote.Name, Owner: remote.Owner.Login, FullName: remote.FullName, Branch: remote.DefaultBranch, Language: remote.Language, Updated: remote.PushedAt, GitHubURL: remote.HTMLURL, Description: remote.Description}
	}
	organisations, organisationsError := loadGitHubPages[githubOrganisation]("user/orgs?per_page=100")
	seenOrganisations := make(map[string]bool)
	addOrganisationRepositories := func(repositories []githubRepository) {
		for _, remote := range repositories {
			key := strings.ToLower(remote.FullName)
			if !seenOrganisations[key] {
				result.Organisations = append(result.Organisations, toRepo(remote))
				seenOrganisations[key] = true
			}
		}
	}
	if organisationsError == nil {
		type organisationResult struct {
			repositories []githubRepository
			err          error
		}
		organisationResults := make(chan organisationResult, len(organisations))
		var organisationGroup sync.WaitGroup
		for _, organisation := range organisations {
			organisationGroup.Add(1)
			go func(login string) {
				defer organisationGroup.Done()
				repositories, repositoryError := loadGitHubPages[githubRepository]("orgs/" + login + "/repos?per_page=100&sort=pushed&type=all")
				organisationResults <- organisationResult{repositories: repositories, err: repositoryError}
			}(organisation.Login)
		}
		organisationGroup.Wait()
		close(organisationResults)
		for organisationResult := range organisationResults {
			if organisationResult.err != nil {
				result.Error = "Some organisation repositories could not be loaded: " + organisationResult.err.Error()
				continue
			}
			addOrganisationRepositories(organisationResult.repositories)
		}
	}
	// This endpoint remains useful when organisation membership visibility or
	// token scopes prevent user/orgs from returning the organisation itself.
	memberRepositories, memberError := loadGitHubPages[githubRepository]("user/repos?per_page=100&affiliation=organization_member&sort=pushed")
	if memberError == nil {
		addOrganisationRepositories(memberRepositories)
	}
	if len(result.Organisations) == 0 && (organisationsError != nil || memberError != nil) {
		result.Error = "Organisation repositories need GitHub organisation access. Run: gh auth refresh -s read:org"
	}
	sort.Slice(result.Organisations, func(leftIndex int, rightIndex int) bool {
		return strings.ToLower(result.Organisations[leftIndex].FullName) < strings.ToLower(result.Organisations[rightIndex].FullName)
	})
	if starredRepositories, starredError := loadGitHubPages[githubRepository]("user/starred?per_page=100"); starredError == nil {
		for _, remote := range starredRepositories {
			result.Starred = append(result.Starred, toRepo(remote))
		}
	} else {
		result.Error = "Starred repositories could not be loaded."
	}
	return result
}
