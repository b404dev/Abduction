import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type { Commit, LanguageStat, PullRequest, PullRequestDetail, Repo, RepositoryStats } from "../../types";

// HistoryView renders Git's real all-ref topological graph and commit metadata.
export function HistoryView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  useEffect(() => {
    Promise.all([api.commits(repo.path), api.branches(repo.path)])
      .then(([commitList, branchList]) => { setCommits(commitList); setBranches(branchList); })
      .catch((reason: unknown) => onError(String(reason)));
  }, [repo.path, onError]);
  return <section className="history git-history"><div className="section-title"><div><span className="eyebrow">All refs · topological order</span><h2>Repository graph</h2></div><span className="count">{commits.length} commits</span></div><div className="branch-strip">{branches.map((branch) => <span className={branch === repo.branch ? "branch-pill branch-pill--active" : "branch-pill"} key={branch}>{branch === repo.branch ? "● " : ""}{branch}</span>)}</div><div className="git-graph">{commits.map((commit) => <article className="graph-commit" key={commit.hash}><pre>{[...(commit.connectors ?? []), commit.graph || "*"].join("\n")}</pre><code>{commit.short}</code><div className="graph-commit__body"><div><strong>{commit.subject || "No commit message"}</strong>{commit.parents.length > 1 ? <span className="merge-chip">merge · {commit.parents.length} parents</span> : null}</div><small>{commit.author} · {formatDate(commit.date)}</small>{commit.refs ? <div className="ref-list">{commit.refs.split(", ").map((reference) => <span key={reference}>{reference}</span>)}</div> : null}</div></article>)}</div></section>;
}

// StatsView explains repository scale, activity, languages, and authorship.
export function StatsView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [statistics, setStatistics] = useState<RepositoryStats | null>(null);
  const [recentCommits, setRecentCommits] = useState<Commit[]>([]);
  const [contributorQuery, setContributorQuery] = useState("");
  useEffect(() => {
    Promise.all([api.repositoryStats(repo.path), api.commits(repo.path)])
      .then(([repositoryStatistics, commitList]) => { setStatistics(repositoryStatistics); setRecentCommits(commitList.slice(0, 12)); })
      .catch((reason: unknown) => onError(String(reason)));
  }, [repo.path, onError]);
  const visibleContributors = useMemo(() => {
    const query = contributorQuery.trim().toLowerCase();
    return (statistics?.contributorsByIdentity ?? []).filter((contributor) => !query || `${contributor.name} ${contributor.email}`.toLowerCase().includes(query));
  }, [statistics, contributorQuery]);
  if (!statistics) return <section className="stats-view"><div className="reader__loading">measuring repository…</div></section>;
  const facts = [{ label: "Commits", value: statistics.commits.toLocaleString() }, { label: "Branches", value: statistics.branches.toLocaleString() }, { label: "Contributors", value: statistics.contributors.toLocaleString() }, { label: "Tracked files", value: statistics.files.toLocaleString() }, { label: "Source lines", value: statistics.lines.toLocaleString() }, { label: "Tracked size", value: formatBytes(statistics.bytes) }];
  return <section className="stats-view">
    <header><div><span className="eyebrow">Repository intelligence</span><h2>{repo.fullName}</h2><p>{repo.path}</p></div><span className="stats-language">{repo.language}</span></header>
    <div className="stats-facts">{facts.map((fact) => <article key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></article>)}</div>
    <div className="stats-visuals"><LanguageDonut languages={statistics.languages}/><article className="stats-signal"><span className="eyebrow">Repository signal</span><h3>{statistics.commits.toLocaleString()} changes across {statistics.contributors} contributors</h3><div><i style={{ width: `${Math.min(100, Math.max(8, statistics.branches * 7))}%` }}/></div><p>{formatDate(statistics.firstCommit)} → {formatDate(statistics.lastCommit)}</p></article></div>
    <div className="stats-detail">
      <article><span className="eyebrow">Language footprint</span><h3>Tracked composition</h3><div className="language-bars">{statistics.languages.slice(0, 10).map((language) => <div key={language.name}><header><strong>{language.name}</strong><span>{language.percent.toFixed(1)}% · {language.files} files</span></header><div><i style={{ width: `${Math.max(language.percent, 1)}%` }}/></div></div>)}</div></article>
      <article className="activity-card"><span className="eyebrow">Activity range</span><h3>Repository lifetime</h3><dl><div><dt>First commit</dt><dd>{formatDate(statistics.firstCommit)}</dd></div><div><dt>Latest commit</dt><dd>{formatDate(statistics.lastCommit)}</dd></div><div><dt>Current branch</dt><dd>{repo.branch || "Detached HEAD"}</dd></div><div><dt>Remote</dt><dd>{repo.githubUrl || "Local only"}</dd></div></dl></article>
      <article className="contributors-card"><div className="card-heading"><div><span className="eyebrow">Authorship</span><h3>Who committed</h3></div><input value={contributorQuery} onChange={(event) => setContributorQuery(event.target.value)} placeholder="Search contributor…" aria-label="Search contributors"/></div><div className="contributor-list">{visibleContributors.map((contributor) => <div key={`${contributor.name}-${contributor.email}`}><header><strong>{contributor.name}</strong><span>{contributor.commits} commits · {contributor.percent.toFixed(1)}%</span></header><small>{contributor.email || "No public email"}</small><i><b style={{ width: `${Math.max(contributor.percent, 1)}%` }}/></i></div>)}{!visibleContributors.length ? <p className="filtered-empty">No contributor matches “{contributorQuery}”.</p> : null}</div></article>
      <article className="recent-commits-card"><span className="eyebrow">Recent work</span><h3>Who changed what</h3><div className="recent-commits">{recentCommits.map((commit) => <div key={commit.hash}><code>{commit.short}</code><p><strong>{commit.subject}</strong><small>{commit.author} · {formatDate(commit.date)}</small></p></div>)}</div></article>
    </div>
  </section>;
}

function LanguageDonut({ languages }: { languages: LanguageStat[] }) {
  let offset = 0;
  const segments = languages.slice(0, 6).map((language) => {
    const segment = { ...language, offset };
    offset += language.percent;
    return segment;
  });
  return <article className="language-donut"><div><svg viewBox="0 0 42 42" role="img" aria-label="Language composition chart"><circle className="donut-track" cx="21" cy="21" r="15.9"/>{segments.map((language, index) => <circle className={`donut-segment donut-segment--${index + 1}`} key={language.name} cx="21" cy="21" r="15.9" pathLength="100" strokeDasharray={`${language.percent} ${100 - language.percent}`} strokeDashoffset={-language.offset}/>)}</svg><strong>{languages[0]?.percent.toFixed(0) ?? 0}%</strong></div><span><b>{languages[0]?.name ?? "Unknown"}</b>primary language</span></article>;
}

// ReviewsView provides searchable pull-request navigation and in-app drill-down.
export function ReviewsView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [query, setQuery] = useState("");
  const [selectedNumber, setSelectedNumber] = useState(0);
  const [detail, setDetail] = useState<PullRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => { api.pullRequests(repo.path).then(setPullRequests).catch((reason: unknown) => onError(String(reason))).finally(() => setLoading(false)); }, [repo.path, onError]);
  const visiblePullRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return pullRequests.filter((pullRequest) => !normalizedQuery || `#${pullRequest.number} ${pullRequest.title} ${pullRequest.author} ${pullRequest.headBranch} ${pullRequest.baseBranch}`.toLowerCase().includes(normalizedQuery));
  }, [pullRequests, query]);
  function selectPullRequest(pullRequest: PullRequest) {
    setSelectedNumber(pullRequest.number);
    setDetail(null);
    setDetailLoading(true);
    api.pullRequestDetail(repo.path, pullRequest.number).then(setDetail).catch((reason: unknown) => onError(String(reason))).finally(() => setDetailLoading(false));
  }
  return <section className={selectedNumber ? "reviews-view reviews-view--detail" : "reviews-view"}>
    <header><div><span className="eyebrow">GitHub collaboration</span><h2>Pull requests</h2></div><span className="count">{visiblePullRequests.length} / {pullRequests.length}</span></header>
    <div className="review-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, author, branch, or number…" aria-label="Search pull requests"/>{selectedNumber ? <button className="ghost" onClick={() => { setSelectedNumber(0); setDetail(null); }}>Close detail</button> : null}</div>
    {loading ? <div className="reader__loading">gathering reviews…</div> : <div className="reviews-layout"><div className="review-list">{visiblePullRequests.map((pullRequest) => <button className={selectedNumber === pullRequest.number ? "review-item review-item--active" : "review-item"} key={pullRequest.number} onClick={() => selectPullRequest(pullRequest)}><span className={pullRequest.state === "OPEN" ? "review-state review-state--open" : "review-state"}>{pullRequest.draft ? "draft" : pullRequest.state.toLowerCase()}</span><div><strong>#{pullRequest.number} {pullRequest.title}</strong><small>@{pullRequest.author} · {pullRequest.headBranch} → {pullRequest.baseBranch} · {formatDate(pullRequest.updated)}</small></div><span>›</span></button>)}{!visiblePullRequests.length ? <div className="empty"><h3>No matching pull requests</h3><p>Try an author, title, branch, or PR number.</p></div> : null}</div>{selectedNumber ? <PullRequestPanel detail={detail} loading={detailLoading}/> : null}</div>}
  </section>;
}

function PullRequestPanel({ detail, loading }: { detail: PullRequestDetail | null; loading: boolean }) {
  if (loading || !detail) return <aside className="pr-detail"><div className="reader__loading">loading pull request…</div></aside>;
  return <aside className="pr-detail"><header><div><span className="eyebrow">PR #{detail.number} · @{detail.author}</span><h3>{detail.title}</h3></div><button className="ghost" onClick={() => api.openURL(detail.url)}>GitHub ↗</button></header><div className="pr-metrics"><span><b className="diff-add">+{detail.additions}</b> additions</span><span><b className="diff-delete">−{detail.deletions}</b> deletions</span><span><b>{detail.changedFiles}</b> files</span><span><b>{detail.commits}</b> commits</span></div><div className="pr-decision"><span>{detail.reviewDecision || "Review pending"}</span><span>{detail.mergeable.toLowerCase()}</span></div>{detail.body ? <p className="pr-body">{detail.body}</p> : null}<section className="pr-files"><h4>Changed files</h4>{detail.files.map((file) => <div key={file.path}><code>{file.path}</code><span className="diff-add">+{file.additions}</span><span className="diff-delete">−{file.deletions}</span></div>)}</section><section className="pr-diff"><h4>Unified diff</h4><pre>{detail.diff.split("\n").map((line, index) => <span className={diffLineClass(line)} key={`${index}-${line.slice(0, 20)}`}>{line || " "}</span>)}</pre></section></aside>;
}

function diffLineClass(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "diff-line diff-line--add";
  if (line.startsWith("-") && !line.startsWith("---")) return "diff-line diff-line--delete";
  if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ")) return "diff-line diff-line--meta";
  return "diff-line";
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
