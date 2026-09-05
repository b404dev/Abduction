import type { Bootstrap, Commit, Config, Document, LinterInfo, LintReport, PullRequest, PullRequestDetail, Repo, RepositorySources, RepositoryStats, ScannerInfo, SearchResult, ThemeName, TreeEntry } from "../src/types";

const repo: Repo = {
  name: "Abduction",
  owner: "b404dev",
  fullName: "b404dev/Abduction",
  path: "/home/bill/Github/Abduction",
  branch: "main",
  language: "Go",
  updated: "2026-09-01T00:00:00Z",
  githubUrl: "https://github.com/b404dev/Abduction",
  description: "Native repository cockpit for local codebases.",
};

const repos = [repo];
const rootEntries: TreeEntry[] = [
  { name: "docs", path: "docs", kind: "directory", size: 0 },
  { name: "README.md", path: "README.md", kind: "file", size: 1536 },
];
const docsEntries: TreeEntry[] = [
  { name: "guide.md", path: "docs/guide.md", kind: "file", size: 768 },
];

const readmeDocument: Document = {
  path: "README.md",
  name: "README.md",
  language: "markdown",
  html: "<h1>Abduction</h1><p>Mock README for the Selenium harness.</p><p>Search result: <strong>readme</strong>.</p>",
  source: "# Abduction\n\nMock README for the Selenium harness.",
  size: 1536,
  lines: 3,
  markdown: true,
  binary: false,
};

const guideDocument: Document = {
  path: "docs/guide.md",
  name: "guide.md",
  language: "markdown",
  html: "<h1>Guide</h1><p>Nested document for tree navigation coverage.</p>",
  source: "# Guide\n\nNested document for tree navigation coverage.",
  size: 768,
  lines: 3,
  markdown: true,
  binary: false,
};

const config: Config = {
  workspace: "/home/bill/Github",
  editor: "code",
  theme: "reaper-dark",
  glow: 1.2,
  radius: 18,
  glass: 0.8,
  scale: 1,
};

let currentBootstrap: Bootstrap = {
  config,
  repos,
  tools: [
    { name: "gitleaks", version: "8.24.0", install: "brew install gitleaks", category: "security", languages: ["Go"], available: true, commands: [{ manager: "brew", command: "brew install gitleaks" }] },
  ],
  platform: "Linux",
  version: "0.1.5",
  error: "",
};

const commits: Commit[] = [
  {
    hash: "abc1234def5678",
    short: "abc1234",
    subject: "Add Selenium smoke harness",
    author: "Bill <bill@example.com>",
    date: "2026-09-01T00:00:00Z",
    graph: "*",
    connectors: [],
    refs: "HEAD -> main",
    parents: [],
  },
  {
    hash: "def5678abc1234",
    short: "def5678",
    subject: "Seed mock repository data",
    author: "Bill <bill@example.com>",
    date: "2026-08-30T00:00:00Z",
    graph: "|\\",
    connectors: ["branch"],
    refs: "origin/main",
    parents: ["abc1234def5678"],
  },
];

function documentFor(path: string, themeName: ThemeName): Document {
  if (path === "docs/guide.md") return guideDocument;
  if (path === "README.md") return readmeDocument;
  return {
    path,
    name: path.split("/").pop() ?? path,
    language: path.endsWith(".go") ? "go" : "plain text",
    html: `<pre><code>${path} @ ${themeName}</code></pre>`,
    source: `${path} @ ${themeName}`,
    size: 256,
    lines: 1,
    markdown: false,
    binary: false,
  };
}

function bootstrap(): Bootstrap {
  return currentBootstrap;
}

function updateConfig(nextConfig: Config): Bootstrap {
  currentBootstrap = { ...currentBootstrap, config: nextConfig };
  return currentBootstrap;
}

function fileSearchResults(query: string): SearchResult[] {
  const normalized = query.toLowerCase();
  if (normalized.includes("read")) return [{ path: "README.md", line: 1, preview: "README.md", kind: "file" }];
  if (normalized.includes("guide")) return [{ path: "docs/guide.md", line: 1, preview: "docs/guide.md", kind: "file" }];
  return [];
}

export const mockBackend = {
  Bootstrap: async () => bootstrap(),
  UpdateConfig: async (nextConfig: Config) => updateConfig(nextConfig),
  ConfigPath: async () => "/home/bill/.config/reaper/config.json",
  SelectWorkspace: async () => "/home/bill/Github",
  RefreshRepos: async () => repos,
  RepositorySources: async () => ({ yours: repos, organisations: [], starred: [], error: "" } as RepositorySources),
  CloneRepository: async (repositoryURL: string) => ({ ...repo, path: "/home/bill/Github/cloned-from-e2e", githubUrl: repositoryURL.replace(/\.git$/, "") }),
  ListDirectory: async (_repositoryPath: string, relativePath: string) => (relativePath === "docs" ? docsEntries : rootEntries),
  SearchRepository: async (_repositoryPath: string, query: string) => fileSearchResults(query),
  SearchRepositoryFiles: async (_repositoryPath: string, query: string) => fileSearchResults(query),
  SearchRepositoryPattern: async (_repositoryPath: string, query: string) => fileSearchResults(query),
  SearchRepositoryFilesPattern: async (_repositoryPath: string, query: string) => fileSearchResults(query),
  ReadOverview: async (_repositoryPath: string, themeName: ThemeName) => documentFor("README.md", themeName),
  ReadFile: async (_repositoryPath: string, relativePath: string, themeName: ThemeName) => documentFor(relativePath, themeName),
  ListRemoteDirectory: async (_fullName: string, relativePath: string) => (relativePath === "docs" ? docsEntries : rootEntries),
  ReadRemoteFile: async (_fullName: string, relativePath: string, _branch: string, themeName: ThemeName) => documentFor(relativePath, themeName),
  ReadRemoteOverview: async (_fullName: string, _branch: string, themeName: ThemeName) => documentFor("README.md", themeName),
  RemoteBranches: async () => ["main", "feature/retro-ufo"],
  PreloadRemoteRepository: async () => 1,
  Commits: async () => commits,
  RepositoryStats: async (): Promise<RepositoryStats> => ({
    commits: 2,
    branches: 2,
    contributors: 1,
    files: 2,
    lines: 3,
    bytes: 2304,
    firstCommit: "2026-08-30T00:00:00Z",
    lastCommit: "2026-09-01T00:00:00Z",
    languages: [{ name: "Go", files: 2, bytes: 2304, percent: 100 }],
    contributorsByIdentity: [{ name: "Bill", email: "bill@example.com", commits: 2, percent: 100 }],
  }),
  PullRequests: async (): Promise<PullRequest[]> => [{ number: 42, title: "Add Selenium smoke harness", author: "bill", state: "open", draft: false, updated: "2026-09-01T00:00:00Z", url: "https://github.com/b404dev/Abduction/pull/42", headBranch: "feat/selenium-e2e-suite", baseBranch: "main" }],
  PullRequestDetail: async (): Promise<PullRequestDetail> => ({ number: 42, title: "Add Selenium smoke harness", author: "bill", state: "OPEN", draft: false, updated: "2026-09-01T00:00:00Z", url: "https://github.com/b404dev/Abduction/pull/42", headBranch: "feat/selenium-e2e-suite", baseBranch: "main", body: "Adds browser-level smoke coverage.", additions: 42, deletions: 3, changedFiles: 2, commits: 1, reviewDecision: "APPROVED", mergeable: "MERGEABLE", files: [{ path: "frontend/e2e/main.tsx", additions: 42, deletions: 3 }], diff: "diff --git a/frontend/e2e/main.tsx b/frontend/e2e/main.tsx\n+smoke test" }),
  SubmitPullRequestReview: async () => undefined,
  OpenURL: async () => undefined,
  GitIdentity: async () => ({ name: "Bill", email: "bill@example.com" }),
  Branches: async () => ["main", "feat/selenium-e2e-suite"],
  SwitchBranch: async (_repositoryPath: string, branch: string) => branch,
  PullLatest: async () => "Already up to date.",
  RepositoryFingerprint: async (repositoryPath: string) => `${repositoryPath}:fingerprint`,
  RefreshRepository: async () => undefined,
  OpenInEditor: async () => undefined,
  OpenRepositoryOnGitHub: async () => undefined,
  StartAnalysis: async () => "job-analysis-1",
  CancelAnalysis: async () => undefined,
  Scanners: async (): Promise<ScannerInfo[]> => [{ name: "gitleaks", available: true, install: "brew install gitleaks", commands: [{ manager: "brew", command: "brew install gitleaks" }] }],
  StartScan: async () => "job-scan-1",
  CancelScan: async () => undefined,
  Linters: async (): Promise<LinterInfo[]> => [{ name: "golangci-lint", available: true, install: "brew install golangci-lint", commands: [{ manager: "brew", command: "brew install golangci-lint" }] }],
  RunLinters: async (): Promise<LintReport[]> => [{ linter: "golangci-lint", diagnostics: [], output: "", error: "" }],
};

export function installMockRuntime() {
  const runtime = {
    EventsOnMultiple: () => () => undefined,
    EventsOn: () => () => undefined,
    EventsOff: () => undefined,
    EventsOffAll: () => undefined,
    EventsOnce: () => () => undefined,
    ClipboardSetText: async () => true,
    BrowserOpenURL: () => undefined,
    LogPrint: () => undefined,
    LogTrace: () => undefined,
    LogDebug: () => undefined,
    LogInfo: () => undefined,
    LogWarning: () => undefined,
    LogError: () => undefined,
    LogFatal: () => undefined,
  };
  Object.assign(window, { runtime, go: { backend: { App: mockBackend } } });
}
