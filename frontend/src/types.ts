export type ThemeName = "reaper-dark" | "reaper-blood" | "reaper-void" | "tokyo-night" | "tokyo-neon" | "tokyo-dusk" | "matte-black" | "matte-ember" | "matte-ice" | "hackerman" | "hackerman-amber" | "hackerman-ghost" | "catppuccin-mocha" | "catppuccin-macchiato" | "catppuccin-frappe" | "catppuccin-latte" | "everforest" | "gruvbox" | "kanagawa" | "nord" | "rose-pine" | "lost-mary";
export type ViewName = "code" | "history" | "stats" | "reviews" | "security" | "analysis" | "tools" | "themes" | "logs" | "settings";
export interface Config { workspace: string; editor: string; theme: ThemeName; glow: number; radius: number; glass: number }
export interface Repo { name: string; owner: string; fullName: string; path: string; branch: string; language: string; updated: string; githubUrl: string; description: string }
export interface RepositorySources { yours: Repo[]; organisations: Repo[]; starred: Repo[]; error: string }
export interface TreeEntry { name: string; path: string; kind: "file" | "directory"; size: number }
export interface SearchResult { path: string; line: number; preview: string; kind: "content" | "file" }
export interface Document { path: string; name: string; language: string; html: string; source: string; size: number; lines: number; markdown: boolean; binary: boolean }
export interface Commit { hash: string; short: string; subject: string; author: string; date: string; graph: string; connectors: string[]; refs: string; parents: string[] }
export interface LanguageStat { name: string; files: number; bytes: number; percent: number }
export interface ContributorStat { name: string; email: string; commits: number; percent: number }
export interface RepositoryStats { commits: number; branches: number; contributors: number; files: number; lines: number; bytes: number; firstCommit: string; lastCommit: string; languages: LanguageStat[]; contributorsByIdentity: ContributorStat[] }
export interface PullRequest { number: number; title: string; author: string; state: string; draft: boolean; updated: string; url: string; headBranch: string; baseBranch: string }
export interface PullRequestFile { path: string; additions: number; deletions: number }
export interface PullRequestDetail extends PullRequest { body: string; additions: number; deletions: number; changedFiles: number; commits: number; reviewDecision: string; mergeable: string; files: PullRequestFile[]; diff: string }
export interface InstallCommand { manager: string; command: string }
export interface Tool { name: string; version: string; install: string; category: string; languages: string[]; available: boolean; commands: InstallCommand[] }
export interface Bootstrap { config: Config; repos: Repo[]; tools: Tool[]; platform: string; version: string; error: string }
export interface AnalysisEvent { jobId: string; provider: string; kind: "started" | "output" | "finished" | "error"; text: string }
export interface ScannerInfo { name: string; available: boolean; install: string; commands: InstallCommand[] }
export interface ScanEvent { jobId: string; scanner: string; kind: string; text: string; reportPath: string }
export interface LinterInfo { name: string; available: boolean; install: string; commands: InstallCommand[] }
export interface LintDiagnostic { linter: string; path: string; line: number; column: number; severity: "warning" | "error"; message: string }
export interface LintReport { linter: string; diagnostics: LintDiagnostic[]; output: string; error: string }
