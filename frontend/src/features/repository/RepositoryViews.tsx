import { useEffect, useState } from "react";
import { api } from "../../api";
import type { Commit, PullRequest, Repo, RepositoryStats } from "../../types";

// HistoryView renders Git's real all-ref topological graph and commit metadata.
export function HistoryView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  useEffect(() => { Promise.all([api.commits(repo.path), api.branches(repo.path)]).then(([commitList, branchList]) => { setCommits(commitList); setBranches(branchList); }).catch((reason: unknown) => onError(String(reason))); }, [repo.path, onError]);
  return <section className="history git-history"><div className="section-title"><div><span className="eyebrow">All refs · topological order</span><h2>Repository graph</h2></div><span className="count">{commits.length} commits</span></div><div className="branch-strip">{branches.map((branch) => <span className={branch === repo.branch ? "branch-pill branch-pill--active" : "branch-pill"} key={branch}>{branch === repo.branch ? "● " : ""}{branch}</span>)}</div><div className="git-graph">{commits.map((commit) => <article className="graph-commit" key={commit.hash}><pre>{[...(commit.connectors ?? []), commit.graph || "*"].join("\n")}</pre><code>{commit.short}</code><div className="graph-commit__body"><div><strong>{commit.subject || "No commit message"}</strong>{commit.parents.length > 1 ? <span className="merge-chip">merge · {commit.parents.length} parents</span> : null}</div><small>{commit.author} · {formatDate(commit.date)}</small>{commit.refs ? <div className="ref-list">{commit.refs.split(", ").map((reference) => <span key={reference}>{reference}</span>)}</div> : null}</div></article>)}</div></section>;
}

// StatsView explains the size, activity, and language makeup of a repository.
export function StatsView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [statistics, setStatistics] = useState<RepositoryStats | null>(null);
  const [recentCommits, setRecentCommits] = useState<Commit[]>([]);
  useEffect(() => { Promise.all([api.repositoryStats(repo.path), api.commits(repo.path)]).then(([repositoryStatistics, commitList]) => { setStatistics(repositoryStatistics); setRecentCommits(commitList.slice(0, 12)); }).catch((reason: unknown) => onError(String(reason))); }, [repo.path, onError]);
  if (!statistics) return <section className="stats-view"><div className="reader__loading">measuring repository…</div></section>;
  const facts = [{ label: "Commits", value: statistics.commits.toLocaleString() }, { label: "Branches", value: statistics.branches.toLocaleString() }, { label: "Contributors", value: statistics.contributors.toLocaleString() }, { label: "Tracked files", value: statistics.files.toLocaleString() }, { label: "Source lines", value: statistics.lines.toLocaleString() }, { label: "Tracked size", value: formatBytes(statistics.bytes) }];
  return <section className="stats-view"><header><div><span className="eyebrow">Repository intelligence</span><h2>{repo.fullName}</h2><p>{repo.path}</p></div><span className="stats-language">{repo.language}</span></header><div className="stats-facts">{facts.map((fact) => <article key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></article>)}</div><div className="stats-detail"><article><span className="eyebrow">Language footprint</span><h3>Tracked composition</h3><div className="language-bars">{statistics.languages.slice(0, 10).map((language) => <div key={language.name}><header><strong>{language.name}</strong><span>{language.percent.toFixed(1)}% · {language.files} files</span></header><div><i style={{ width: `${Math.max(language.percent, 1)}%` }}/></div></div>)}</div></article><article className="activity-card"><span className="eyebrow">Activity range</span><h3>Repository lifetime</h3><dl><div><dt>First commit</dt><dd>{formatDate(statistics.firstCommit)}</dd></div><div><dt>Latest commit</dt><dd>{formatDate(statistics.lastCommit)}</dd></div><div><dt>Current branch</dt><dd>{repo.branch || "Detached HEAD"}</dd></div><div><dt>Remote</dt><dd>{repo.githubUrl || "Local only"}</dd></div></dl></article><article className="contributors-card"><span className="eyebrow">Authorship</span><h3>Who committed</h3><div className="contributor-list">{statistics.contributorsByIdentity.slice(0, 10).map((contributor) => <div key={`${contributor.name}-${contributor.email}`}><header><strong>{contributor.name}</strong><span>{contributor.commits} commits · {contributor.percent.toFixed(1)}%</span></header><small>{contributor.email || "No public email"}</small><i><b style={{ width: `${Math.max(contributor.percent, 1)}%` }}/></i></div>)}</div></article><article className="recent-commits-card"><span className="eyebrow">Recent work</span><h3>Who changed what</h3><div className="recent-commits">{recentCommits.map((commit) => <div key={commit.hash}><code>{commit.short}</code><p><strong>{commit.subject}</strong><small>{commit.author} · {formatDate(commit.date)}</small></p></div>)}</div></article></div></section>;
}

// ReviewsView keeps GitHub pull requests close to the repository reading context.
export function ReviewsView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.pullRequests(repo.path).then(setPullRequests).catch((reason: unknown) => onError(String(reason))).finally(() => setLoading(false)); }, [repo.path, onError]);
  return <section className="reviews-view"><header><div><span className="eyebrow">GitHub collaboration</span><h2>Pull requests</h2></div><span className="count">{pullRequests.length}</span></header>{loading ? <div className="reader__loading">gathering reviews…</div> : <div className="review-list">{pullRequests.map((pullRequest) => <button key={pullRequest.number} onClick={() => api.openURL(pullRequest.url)}><span className={pullRequest.state === "OPEN" ? "review-state review-state--open" : "review-state"}>{pullRequest.draft ? "draft" : pullRequest.state.toLowerCase()}</span><div><strong>#{pullRequest.number} {pullRequest.title}</strong><small>{pullRequest.author} · {pullRequest.headBranch} → {pullRequest.baseBranch} · {formatDate(pullRequest.updated)}</small></div><span>↗</span></button>)}{!pullRequests.length ? <div className="empty"><h3>No pull requests</h3><p>This repository has no GitHub review items to show.</p></div> : null}</div>}</section>;
}


function formatBytes(size: number): string {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: string): string {
  const parsedDate = new Date(timestamp);
  return Number.isNaN(parsedDate.valueOf()) ? timestamp : parsedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
