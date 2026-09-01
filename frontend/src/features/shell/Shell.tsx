import { useEffect, useMemo, useState } from "react";
import { BarChart3, BrainCircuit, Braces, Command, GitBranch, GitPullRequestArrow, Keyboard, Palette, ScrollText, Settings2, ShieldCheck, Wrench, type LucideIcon } from "lucide-react";
import { api } from "../../api";
import type { Repo, RepositorySources, ViewName } from "../../types";
import { fuzzyFilter } from "../../search";

export const destinations: { name: ViewName; label: string; key: string; icon: LucideIcon }[] = [
  { name: "code", label: "Code", key: "1", icon: Braces }, { name: "history", label: "History", key: "2", icon: GitBranch }, { name: "stats", label: "Stats", key: "3", icon: BarChart3 },
  { name: "reviews", label: "Reviews", key: "4", icon: GitPullRequestArrow }, { name: "security", label: "Security", key: "5", icon: ShieldCheck }, { name: "analysis", label: "Analysis", key: "6", icon: BrainCircuit },
  { name: "tools", label: "Dependencies", key: "7", icon: Wrench }, { name: "themes", label: "Themes", key: "8", icon: Palette }, { name: "logs", label: "Logs", key: "9", icon: ScrollText }, { name: "settings", label: "Settings", key: "0", icon: Settings2 },
];

function UfoLoader({ label }: { label: string }) {
  return <div className="ufo-loader" role="status" aria-label={label}><span className="ufo-loader__craft"><i/><b/></span><span>{label}</span></div>;
}

export function Loading({ error }: { error: string }) {
  return <main className="loading"><AlienGlyph/><h1>abduction</h1>{error ? <p>{error}</p> : <UfoLoader label="scanning your workspace…"/>}</main>;
}

// Titlebar provides a native draggable strip for the frameless window.
export function Titlebar({ version, platform, repos, selectedRepo, onSelect, onCloned, onCommand, onShortcuts, onError }: { version: string; platform: string; repos: Repo[]; selectedRepo: Repo | null; onSelect: (repo: Repo) => void; onCloned: (repo: Repo) => void; onCommand: () => void; onShortcuts: () => void; onError: (message: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [switchingBranch, setSwitchingBranch] = useState(false);
  const [cloneURL, setCloneURL] = useState("");
  const [cloning, setCloning] = useState("");
  const [activeRepoIndex, setActiveRepoIndex] = useState(0);
  const [repoSource, setRepoSource] = useState<"yours" | "organisations" | "starred">("yours");
  const [repositorySources, setRepositorySources] = useState<RepositorySources>({ yours: repos, organisations: [], starred: [], error: "" });
  const [loadingSources, setLoadingSources] = useState(false);
  const sourceRepos = repositorySources[repoSource];
  const filteredRepos = useMemo(() => {
    const normalizedQuery = pickerQuery.trim().toLowerCase();
    return normalizedQuery ? fuzzyFilter(sourceRepos, normalizedQuery, (repository) => `${repository.fullName} ${repository.description}`) : sourceRepos;
  }, [pickerQuery, sourceRepos]);

  useEffect(() => { setActiveRepoIndex(0); }, [pickerQuery, pickerOpen, repoSource]);
  useEffect(() => {
    if (!pickerOpen) return;
    setRepositorySources((current) => ({ ...current, yours: current.yours.length ? current.yours : repos }));
    setLoadingSources(repositorySources.organisations.length === 0 && repositorySources.starred.length === 0);
    api.repositorySources().then(setRepositorySources).catch((reason: unknown) => onError(String(reason))).finally(() => setLoadingSources(false));
  }, [pickerOpen, repos, onError]);

  useEffect(() => {
    if (!selectedRepo) { setBranches([]); return; }
    const branchRequest = selectedRepo.path ? api.branches(selectedRepo.path) : api.remoteBranches(selectedRepo.fullName);
    branchRequest.then(setBranches).catch((reason: unknown) => { setBranches([]); onError(String(reason)); });
  }, [selectedRepo]);

  useEffect(() => {
    const branchSelect = document.querySelector<HTMLSelectElement>(".branch-picker select");
    if (branchSelect && selectedRepo && !selectedRepo.path) branchSelect.disabled = switchingBranch;
  }, [selectedRepo, branches, switchingBranch]);

  useEffect(() => {
    // handleShortcut keeps repository switching available while reading any file.
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") { event.preventDefault(); setPickerOpen(true); }
      if (event.key === "Escape") setPickerOpen(false);
      if ((event.key === "[" || event.key === "]") && !isEditingTarget(event.target)) {
        const currentIndex = repos.findIndex((repository) => repository.path === selectedRepo?.path);
        const direction = event.key === "]" ? 1 : -1;
        const nextIndex = (Math.max(currentIndex, 0) + direction + repos.length) % repos.length;
        if (repos[nextIndex]) onSelect(repos[nextIndex]);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onSelect, repos, selectedRepo]);

  // chooseRepository selects a result and immediately returns focus to reading.
  function chooseRepository(repository: Repo) {
    onSelect(repository); setPickerOpen(false); setPickerQuery("");
  }

  // chooseBranch checks out a known branch and refreshes the active repository context.
  function chooseBranch(branch: string) {
    if (!selectedRepo || branch === selectedRepo.branch) return;
    if (!selectedRepo.path) { onSelect({ ...selectedRepo, branch }); return; }
    setSwitchingBranch(true);
    api.switchBranch(selectedRepo.path, branch).then((resolvedBranch) => onSelect({ ...selectedRepo, branch: resolvedBranch })).finally(() => setSwitchingBranch(false));
  }

  // cloneRepository adds a remote checkout to the configured workspace.
  function cloneRepository() {
    const repositoryURL = cloneURL.trim();
    if (!repositoryURL || cloning) return;
    setCloning(repositoryURL);
    api.cloneRepository(repositoryURL).then((repository) => { onCloned(repository); setCloneURL(""); setPickerOpen(false); }).catch((reason: unknown) => onError(String(reason))).finally(() => setCloning(""));
  }

  function handlePickerKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveRepoIndex((currentIndex) => (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + filteredRepos.length) % Math.max(filteredRepos.length, 1)); }
    if (event.key === "Enter" && filteredRepos[activeRepoIndex]) { event.preventDefault(); chooseRepository(filteredRepos[activeRepoIndex]); }
    if (event.key.toLowerCase() === "c" && !pickerQuery && filteredRepos[activeRepoIndex] && !filteredRepos[activeRepoIndex].path) { event.preventDefault(); const repository = filteredRepos[activeRepoIndex]; setCloning(repository.fullName); api.cloneRepository(repository.githubUrl + ".git").then(onCloned).then(() => setPickerOpen(false)).catch((reason: unknown) => onError(String(reason))).finally(() => setCloning("")); }
  }

  return <><header className="titlebar"><BrandIdentity/><div className="top-context"><button className="repo-picker" onClick={() => setPickerOpen(true)}><span>Repository</span><strong>{selectedRepo?.fullName ?? "Select a repository"}</strong><kbd>⌘P</kbd></button><label className="branch-picker"><GitBranch size={15}/><select disabled={!selectedRepo?.path || switchingBranch} value={selectedRepo?.branch ?? ""} onChange={(event) => chooseBranch(event.target.value)} aria-label="Branch">{selectedRepo?.branch && !branches.includes(selectedRepo.branch) ? <option value={selectedRepo.branch}>{selectedRepo.branch}</option> : null}{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label></div><div className="titlebar__actions"><button onClick={onCommand} aria-label="Open command palette"><Command size={15}/><kbd>⌘K</kbd></button><button onClick={onShortcuts} aria-label="Show keyboard shortcuts"><Keyboard size={16}/></button><small>{platform} · v{version}</small></div></header>{pickerOpen ? <div className="picker-backdrop" onMouseDown={() => setPickerOpen(false)}><section className="picker" role="dialog" aria-modal="true" aria-label="Open repository" onMouseDown={(event) => event.stopPropagation()}><header><span className="eyebrow">Quick switch</span><h2>Open repository</h2></header><div className="repo-source-tabs">{(["yours", "organisations", "starred"] as const).map((source) => <button key={source} className={repoSource === source ? "repo-source-tab repo-source-tab--active" : "repo-source-tab"} onClick={() => setRepoSource(source)}><span>{source === "yours" ? "On disk" : source === "organisations" ? "Organisations" : "Starred"}</span><b>{repositorySources[source].length}</b></button>)}</div>{repositorySources.error ? <p className="picker-source-error">{repositorySources.error}</p> : null}<input autoFocus value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} onKeyDown={handlePickerKey} placeholder="Search owner or repository…"/><div className="picker__list" role="listbox">{loadingSources && repoSource !== "yours" ? <UfoLoader label={`loading ${repoSource}…`}/> : filteredRepos.map((repository, repositoryIndex) => <button key={repository.fullName} role="option" aria-selected={repositoryIndex === activeRepoIndex} className={repositoryIndex === activeRepoIndex ? "picker__option--active" : ""} onMouseEnter={() => setActiveRepoIndex(repositoryIndex)} onClick={() => chooseRepository(repository)} disabled={Boolean(cloning)}><span className="repo__glyph">{repository.path ? "⌁" : "☁"}</span><span><strong>{repository.name}</strong><small>{repository.owner} · {repository.language || "Unknown"}{repository.description ? ` · ${repository.description}` : ""}</small></span><span className={repository.path ? "repo-action repo-action--local" : "repo-action"}>{repository.path ? repository.branch || "On disk" : "View remote"}</span></button>)}{!loadingSources && !filteredRepos.length ? <p className="picker-empty">No repositories in this source.</p> : null}</div><div className="clone-box"><div><span className="eyebrow">Add to workspace</span><strong>Clone from URL</strong></div><div><input value={cloneURL} onChange={(event) => setCloneURL(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") cloneRepository(); }} placeholder="https://github.com/owner/repository.git"/><button className="primary" disabled={!cloneURL.trim() || Boolean(cloning)} onClick={cloneRepository}>{cloning === cloneURL.trim() ? "Cloning…" : "Clone"}</button></div></div><footer><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></footer></section></div> : null}</>;
}

// BrandIdentity renders Abduction's compact craft and wordmark.
function BrandIdentity() {
  return <div className="brand"><span className="brand__icon"><AlienGlyph/></span><div className="brand__word"><strong><span>abduct</span><i>ion</i></strong><small>repository encounters</small></div></div>;
}

function AlienGlyph() {
  return <svg className="alien-glyph" viewBox="0 0 64 64" aria-hidden>
    <defs>
      <linearGradient id="alien-mark-gradient" x1="9" y1="10" x2="54" y2="54"><stop stopColor="var(--cyan)"/><stop offset=".48" stopColor="var(--accent)"/><stop offset="1" stopColor="var(--accent-2)"/></linearGradient>
      <linearGradient id="alien-beam-gradient" x1="32" y1="35" x2="32" y2="59" gradientUnits="userSpaceOnUse"><stop stopColor="var(--cyan)" stopOpacity=".42"/><stop offset="1" stopColor="var(--accent-2)" stopOpacity=".04"/></linearGradient>
    </defs>
    <path className="alien-glyph__dome" d="M20.3 27.2C21.4 18.7 25.8 14 32 14s10.6 4.7 11.7 13.2"/>
    <path className="alien-glyph__glass" d="M23.9 25.8c1.4-5.7 4.1-8.1 8.1-8.1s6.7 2.4 8.1 8.1"/>
    <path className="alien-glyph__hull" d="M8.5 31.2c5.7-6 13.5-8.7 23.5-8.7s17.8 2.7 23.5 8.7c-2.6 7.2-11.2 11-23.5 11s-20.9-3.8-23.5-11Z"/>
    <path className="alien-glyph__rim" d="M11.3 31.5c6.4 2 13.3 3 20.7 3s14.3-1 20.7-3"/>
    <path className="alien-glyph__beam" d="m23.2 41.1-7 18h31.6l-7-18c-2.5.7-5.4 1.1-8.8 1.1s-6.3-.4-8.8-1.1Z"/>
    <path className="alien-glyph__code" d="m27.5 47-3.7 3 3.7 3M36.5 47l3.7 3-3.7 3M34 45.7 30 54.3"/>
    <g className="alien-glyph__lights"><circle cx="18.5" cy="32.2" r="1.4"/><circle cx="26" cy="34" r="1.4"/><circle cx="38" cy="34" r="1.4"/><circle cx="45.5" cy="32.2" r="1.4"/></g>
  </svg>;
}

// isEditingTarget prevents navigation shortcuts from stealing normal typing.
export function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

// Rail keeps primary destinations stable while contextual content drills in beside it.
export function Rail({ view, onView, errorCount }: { view: ViewName; onView: (view: ViewName) => void; errorCount: number }) {
  return <nav className="rail" aria-label="Primary navigation"><div className="rail__brand">R</div>{destinations.map((destination) =>
    <button key={destination.name} className={view === destination.name ? "rail__item rail__item--active" : "rail__item"} onClick={() => onView(destination.name)} aria-label={`${destination.label} (${destination.key})`} aria-current={view === destination.name ? "page" : undefined} data-label={destination.key}><destination.icon className="rail__icon" strokeWidth={1.7}/><span className="rail__label">{destination.label}</span>{destination.name === "logs" && errorCount ? <b className="rail__badge">{Math.min(errorCount, 99)}</b> : null}</button>)}<div className="rail__spacer"/></nav>;
}

// WorkspaceHeader shows repository context and global appearance controls.
export function WorkspaceHeader({ repo, onClone, onRefresh, onError }: { repo: Repo | null; onClone: (repository: Repo) => Promise<void>; onRefresh: () => Promise<void>; onError: (message: string) => void }) {
  const [pulling, setPulling] = useState(false);
  const [cloningRemote, setCloningRemote] = useState(false);
  const [pullStatus, setPullStatus] = useState("");
  function pullLatest() {
    if (!repo || pulling) return;
    setPulling(true); setPullStatus("");
    api.pullLatest(repo.path).then(async (output) => { setPullStatus(output.includes("Already up to date") ? "Up to date" : "Updated"); await onRefresh(); }).catch((reason: unknown) => onError(String(reason))).finally(() => setPulling(false));
  }
  useEffect(() => { setPullStatus(""); }, [repo?.path]);
  return <header className="workspace__header"><div>{repo ? <><span className="eyebrow">{repo.path ? repo.language : `Remote · ${repo.owner}`}</span><h1>{repo.name}</h1></> : <h1>Choose a repository</h1>}</div><div className="header-actions">{pullStatus ? <span className="pull-status">{pullStatus}</span> : null}{repo?.path ? <button className="ghost refresh-action" onClick={() => void onRefresh()}>Refresh</button> : null}{repo?.path ? <button className="primary pull-action" disabled={pulling} onClick={pullLatest}>{pulling ? "Pulling…" : "Pull latest"}</button> : null}{repo?.path ? <button className="ghost editor-action" onClick={() => api.openInEditor(repo.path, "")}>Open editor</button> : null}{repo && !repo.path ? <button className="primary" disabled={cloningRemote} onClick={() => { setCloningRemote(true); onClone(repo).catch((reason: unknown) => onError(String(reason))).finally(() => setCloningRemote(false)); }}>{cloningRemote ? "Cloning…" : "Clone to workspace"}</button> : null}{repo?.githubUrl ? <button className="ghost github-action" onClick={() => api.openOnGitHub(repo)}>GitHub ↗</button> : null}</div></header>;
}

export function RemoteRepositoryNotice({ repo }: { repo: Repo }) {
  return <section className="empty panel"><div className="repo__glyph">☁</div><h2>Remote repository</h2><p>{repo.fullName} is open in read-only mode. Browse its files under Code, or clone it to unlock local history, analysis, security, and tooling.</p></section>;
}
