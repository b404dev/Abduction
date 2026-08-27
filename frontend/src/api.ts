import type { Bootstrap, Commit, Config, Document, LinterInfo, LintReport, PullRequest, Repo, RepositorySources, RepositoryStats, ScannerInfo, SearchResult, ThemeName, TreeEntry } from "./types";

interface AbductionBackend {
  Bootstrap(): Promise<Bootstrap>;
  UpdateConfig(configuration: Config): Promise<Bootstrap>;
  ConfigPath(): Promise<string>;
  SelectWorkspace(): Promise<string>;
  RefreshRepos(): Promise<Repo[]>;
  RepositorySources(): Promise<RepositorySources>;
  CloneRepository(repositoryURL: string): Promise<Repo>;
  ListDirectory(repositoryPath: string, relativePath: string): Promise<TreeEntry[]>;
  SearchRepository(repositoryPath: string, query: string): Promise<SearchResult[]>;
  SearchRepositoryFiles(repositoryPath: string, query: string): Promise<SearchResult[]>;
  SearchRepositoryPattern(repositoryPath: string, query: string, useRegex: boolean): Promise<SearchResult[]>;
  SearchRepositoryFilesPattern(repositoryPath: string, query: string, useRegex: boolean): Promise<SearchResult[]>;
  ReadOverview(repositoryPath: string, themeName: ThemeName): Promise<Document>;
  ReadFile(repositoryPath: string, relativePath: string, themeName: ThemeName): Promise<Document>;
  Commits(repositoryPath: string): Promise<Commit[]>;
  RepositoryStats(repositoryPath: string): Promise<RepositoryStats>;
  PullRequests(repositoryPath: string): Promise<PullRequest[]>;
  OpenURL(address: string): Promise<void>;
  Branches(repositoryPath: string): Promise<string[]>;
  SwitchBranch(repositoryPath: string, branch: string): Promise<string>;
  OpenInEditor(repositoryPath: string, relativePath: string): Promise<void>;
  OpenRepositoryOnGitHub(repository: Repo): Promise<void>;
  StartAnalysis(repositoryPath: string, provider: string, prompt: string): Promise<string>;
  CancelAnalysis(jobID: string): Promise<void>;
  Scanners(): Promise<ScannerInfo[]>;
  StartScan(repositoryPath: string, scannerName: string): Promise<string>;
  CancelScan(jobID: string): Promise<void>;
  Linters(language: string): Promise<LinterInfo[]>;
  RunLinters(repositoryPath: string, relativePath: string, language: string, names: string[]): Promise<LintReport[]>;
}

declare global { interface Window { go?: { main?: { App?: AbductionBackend } } } }

type CacheEntry = { value?: unknown; promise?: Promise<unknown>; expiresAt: number };
const queryCache = new Map<string, CacheEntry>();

// cached coalesces identical bridge calls and retains successful values across view remounts.
function cached<T>(key: string, load: () => Promise<T>, ttl = Number.POSITIVE_INFINITY): Promise<T> {
  const now = Date.now();
  const existing = queryCache.get(key);
  if (existing?.promise) return existing.promise as Promise<T>;
  if (existing && existing.expiresAt > now && "value" in existing) return Promise.resolve(existing.value as T);
  const promise = load().then((value) => {
    queryCache.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
  }).catch((reason) => {
    queryCache.delete(key);
    throw reason;
  });
  queryCache.set(key, { promise, expiresAt: now + ttl });
  return promise;
}

// invalidateRepository drops derived state after an operation changes repository identity or refs.
function invalidateRepository(repositoryPath: string) {
  const encodedPath = encodeURIComponent(repositoryPath);
  for (const key of queryCache.keys()) if (key.includes(encodedPath)) queryCache.delete(key);
}

// invalidateAll clears application-lifetime state after workspace configuration changes.
function invalidateAll() { queryCache.clear(); }

function cacheKey(operation: string, ...parts: string[]) { return `${operation}:${parts.map(encodeURIComponent).join(":")}`; }

// backend returns the generated Wails bridge or explains why it is unavailable.
function backend(): AbductionBackend {
  const applicationBackend = window.go?.main?.App;
  if (!applicationBackend) throw new Error("The Abduction desktop bridge is unavailable. Run the app through Wails.");
  return applicationBackend;
}

// api exposes the small typed surface consumed by React components.
export const api = {
  bootstrap: (): Promise<Bootstrap> => cached("bootstrap", () => backend().Bootstrap()),
  updateConfig: (configuration: Config): Promise<Bootstrap> => backend().UpdateConfig(configuration).then((result) => { invalidateAll(); queryCache.set("bootstrap", { value: result, expiresAt: Number.POSITIVE_INFINITY }); return result; }),
  configPath: (): Promise<string> => cached("config-path", () => backend().ConfigPath()),
  selectWorkspace: (): Promise<string> => backend().SelectWorkspace(),
  refreshRepos: (): Promise<Repo[]> => backend().RefreshRepos().then((repositories) => { queryCache.delete("bootstrap"); return repositories; }),
  repositorySources: (): Promise<RepositorySources> => backend().RepositorySources(),
  cloneRepository: (repositoryURL: string): Promise<Repo> => backend().CloneRepository(repositoryURL).then((repository) => { queryCache.delete("bootstrap"); return repository; }),
  listDirectory: (repositoryPath: string, relativePath: string): Promise<TreeEntry[]> => cached(cacheKey("directory", repositoryPath, relativePath), () => backend().ListDirectory(repositoryPath, relativePath), 10_000),
  searchRepository: (repositoryPath: string, query: string): Promise<SearchResult[]> => backend().SearchRepository(repositoryPath, query),
  searchRepositoryFiles: (repositoryPath: string, query: string): Promise<SearchResult[]> => backend().SearchRepositoryFiles(repositoryPath, query),
  searchRepositoryPattern: (repositoryPath: string, query: string, useRegex: boolean): Promise<SearchResult[]> => backend().SearchRepositoryPattern(repositoryPath, query, useRegex),
  searchRepositoryFilesPattern: (repositoryPath: string, query: string, useRegex: boolean): Promise<SearchResult[]> => backend().SearchRepositoryFilesPattern(repositoryPath, query, useRegex),
  readOverview: (repositoryPath: string, themeName: ThemeName): Promise<Document> => cached(cacheKey("overview", repositoryPath, themeName), () => backend().ReadOverview(repositoryPath, themeName), 10_000),
  readFile: (repositoryPath: string, relativePath: string, themeName: ThemeName): Promise<Document> => cached(cacheKey("document", repositoryPath, relativePath, themeName), () => backend().ReadFile(repositoryPath, relativePath, themeName), 10_000),
  commits: (repositoryPath: string): Promise<Commit[]> => cached(cacheKey("commits", repositoryPath), () => backend().Commits(repositoryPath), 15_000),
  repositoryStats: (repositoryPath: string): Promise<RepositoryStats> => cached(cacheKey("stats", repositoryPath), () => backend().RepositoryStats(repositoryPath), 60_000),
  pullRequests: (repositoryPath: string): Promise<PullRequest[]> => cached(cacheKey("pull-requests", repositoryPath), () => backend().PullRequests(repositoryPath), 60_000),
  openURL: (address: string): Promise<void> => backend().OpenURL(address),
  branches: (repositoryPath: string): Promise<string[]> => cached(cacheKey("branches", repositoryPath), () => backend().Branches(repositoryPath), 15_000),
  switchBranch: (repositoryPath: string, branch: string): Promise<string> => backend().SwitchBranch(repositoryPath, branch).then((resolvedBranch) => { invalidateRepository(repositoryPath); return resolvedBranch; }),
  openInEditor: (repositoryPath: string, relativePath: string): Promise<void> => backend().OpenInEditor(repositoryPath, relativePath),
  openOnGitHub: (repository: Repo): Promise<void> => backend().OpenRepositoryOnGitHub(repository),
  startAnalysis: (repositoryPath: string, provider: string, prompt: string): Promise<string> => backend().StartAnalysis(repositoryPath, provider, prompt),
  cancelAnalysis: (jobID: string): Promise<void> => backend().CancelAnalysis(jobID),
  scanners: (): Promise<ScannerInfo[]> => cached("scanners", () => backend().Scanners()),
  startScan: (repositoryPath: string, scannerName: string): Promise<string> => backend().StartScan(repositoryPath, scannerName),
  cancelScan: (jobID: string): Promise<void> => backend().CancelScan(jobID),
  linters: (language: string): Promise<LinterInfo[]> => backend().Linters(language),
  runLinters: (repositoryPath: string, relativePath: string, language: string, names: string[]): Promise<LintReport[]> => backend().RunLinters(repositoryPath, relativePath, language, names),
};
