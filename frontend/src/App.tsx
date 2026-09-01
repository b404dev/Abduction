import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, BrainCircuit, Braces, Command, GitBranch, GitPullRequestArrow, Keyboard, Palette, ScrollText, Settings2, ShieldCheck, Wrench, type LucideIcon } from "lucide-react";
import { api } from "./api";
import type { Bootstrap, Repo, RepositorySources, ThemeName, ViewName } from "./types";
import { FirstRunGuide } from "./components/FirstRunGuide";
import { Splash } from "./components/Splash";
import { fuzzyFilter } from "./search";
import { CodeView } from "./features/code/CodeView";
import { HistoryView, ReviewsView, StatsView } from "./features/repository/RepositoryViews";
import { AnalysisView, SecurityView, ToolsView } from "./features/operations/OperationViews";

const themes: { name: ThemeName; label: string; palette: string[] }[] = [
  { name: "reaper-dark", label: "Abduction Night", palette: ["#050713", "#315cff", "#19d9ff", "#a449ff"] },
  { name: "reaper-blood", label: "Abduction Signal", palette: ["#080308", "#ff315f", "#ff784f", "#a84dff"] },
  { name: "reaper-void", label: "Abduction Void", palette: ["#020106", "#7a3cff", "#00e5ff", "#e349ff"] },
  { name: "tokyo-night", label: "Orbital Night", palette: ["#1a1b26", "#7aa2f7", "#bb9af7", "#9ece6a"] },
  { name: "tokyo-neon", label: "Neon Sighting", palette: ["#080b18", "#2ac3ff", "#ff3dbb", "#adff2f"] },
  { name: "tokyo-dusk", label: "Dusk Encounter", palette: ["#171522", "#8b7cff", "#ff7eb6", "#ffc66d"] },
  { name: "matte-black", label: "Black Site", palette: ["#090909", "#e68e0d", "#bebebe", "#b91c1c"] },
  { name: "matte-ember", label: "Crash Site", palette: ["#070605", "#ff7a18", "#ffd166", "#db2b39"] },
  { name: "matte-ice", label: "Arctic Contact", palette: ["#050708", "#83e9ff", "#d7f6ff", "#5773ff"] },
  { name: "hackerman", label: "Terminal Contact", palette: ["#06060c", "#50f872", "#7cf8f7", "#829dd4"] },
  { name: "hackerman-amber", label: "Amber Transmission", palette: ["#070603", "#ffbf36", "#ffef9a", "#ff6b2c"] },
  { name: "hackerman-ghost", label: "Ghost Signal", palette: ["#020807", "#2fffc1", "#b8fff1", "#00a8ff"] },
  { name: "catppuccin-mocha", label: "Mocha Nebula", palette: ["#11111b", "#89b4fa", "#cba6f7", "#89dceb"] },
  { name: "catppuccin-macchiato", label: "Macchiato Orbit", palette: ["#181926", "#8aadf4", "#c6a0f6", "#91d7e3"] },
  { name: "catppuccin-frappe", label: "Frappé Horizon", palette: ["#232634", "#8caaee", "#ca9ee6", "#99d1db"] },
  { name: "catppuccin-latte", label: "Daylight Sighting", palette: ["#e6e9ef", "#1e66f5", "#8839ef", "#04a5e5"] },
  { name: "everforest", label: "Forest Landing", palette: ["#181d20", "#7fbbb3", "#d699b6", "#a7c080"] },
  { name: "gruvbox", label: "Desert Signal", palette: ["#161616", "#d8a657", "#d3869b", "#89b482"] },
  { name: "kanagawa", label: "Shogun Night", palette: ["#111116", "#7e9cd8", "#957fb8", "#98bb6c"] },
  { name: "nord", label: "Polar Beacon", palette: ["#191c23", "#81a1c1", "#b48ead", "#88c0d0"] },
  { name: "rose-pine", label: "Rosé Landing", palette: ["#faf4ed", "#56949f", "#907aa9", "#d7827e"] },
  { name: "lost-mary", label: "Lost Mary", palette: ["#070a03", "#ffe600", "#6dff3f", "#ff3b30"] },
];

type LogEntry = { id: number; timestamp: string; level: "error"; message: string };
type AppCommand = { id: string; label: string; detail: string; keys: string[]; icon: LucideIcon; run: () => void };

const destinations: { name: ViewName; label: string; key: string; icon: LucideIcon }[] = [
  { name: "code", label: "Code", key: "1", icon: Braces }, { name: "history", label: "History", key: "2", icon: GitBranch }, { name: "stats", label: "Stats", key: "3", icon: BarChart3 },
  { name: "reviews", label: "Reviews", key: "4", icon: GitPullRequestArrow }, { name: "security", label: "Security", key: "5", icon: ShieldCheck }, { name: "analysis", label: "Analysis", key: "6", icon: BrainCircuit },
  { name: "tools", label: "Dependencies", key: "7", icon: Wrench }, { name: "themes", label: "Themes", key: "8", icon: Palette }, { name: "logs", label: "Logs", key: "9", icon: ScrollText }, { name: "settings", label: "Settings", key: "0", icon: Settings2 },
];

// App coordinates the small amount of shared desktop navigation state.
export default function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [view, setView] = useState<ViewName>("code");
  const [theme, setTheme] = useState<ThemeName>(() => {
    const savedTheme = localStorage.getItem("reaper-theme") as ThemeName | null;
    return savedTheme && themes.some((themeOption) => themeOption.name === savedTheme) ? savedTheme : "reaper-dark";
  });
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [splashReady, setSplashReady] = useState(() => Date.now() - Number(localStorage.getItem("abduction-splash-seen") ?? 0) < 6 * 60 * 60 * 1000);
  const [guideOpen, setGuideOpen] = useState(() => localStorage.getItem("abduction-guide-seen") !== "1");
  const [emptySetupDismissed, setEmptySetupDismissed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [repositoryEpoch, setRepositoryEpoch] = useState(0);
  const repositoryFingerprint = useRef("");

  // recordError retains actionable failures in the diagnostic workspace.
  const recordError = useCallback((message: string) => {
    const normalizedMessage = message.trim() || "Unknown application error";
    setError(normalizedMessage);
    setLogs((currentLogs) => [...currentLogs.slice(-249), { id: Date.now() + currentLogs.length, timestamp: new Date().toISOString(), level: "error", message: normalizedMessage }]);
  }, []);

  const refreshActiveRepository = useCallback(async () => {
    if (!selectedRepo?.path) return;
    await api.refreshRepository(selectedRepo.path);
    setRepositoryEpoch((currentEpoch) => currentEpoch + 1);
  }, [selectedRepo]);

  const cloneRemoteRepository = useCallback(async (repository: Repo) => {
    if (!repository.githubUrl || repository.path) return;
    const clonedRepository = await api.cloneRepository(repository.githubUrl + ".git");
    setSelectedRepo(clonedRepository);
    const repositories = await api.refreshRepos();
    setBootstrap((currentBootstrap) => currentBootstrap ? { ...currentBootstrap, repos: repositories } : currentBootstrap);
  }, []);

  useEffect(() => {
    repositoryFingerprint.current = "";
    if (!selectedRepo?.path) return;
    let stopped = false;
    const checkForChanges = async () => {
      try {
        const nextFingerprint = await api.repositoryFingerprint(selectedRepo.path);
        if (stopped) return;
        if (repositoryFingerprint.current && repositoryFingerprint.current !== nextFingerprint) await refreshActiveRepository();
        repositoryFingerprint.current = nextFingerprint;
      } catch { /* Background refresh remains best-effort. */ }
    };
    void checkForChanges();
    const refreshTimer = window.setInterval(() => { void checkForChanges(); }, 5000);
    return () => { stopped = true; window.clearInterval(refreshTimer); };
  }, [selectedRepo, refreshActiveRepository]);

  useEffect(() => {
    api.bootstrap().then((initialState) => {
      setBootstrap(initialState);
      if (initialState.error) recordError(initialState.error);
      const initialRepository = initialState.repos[0] ?? null;
      setSelectedRepo(initialRepository);
      if (initialRepository) {
        void Promise.all([
          api.listDirectory(initialRepository.path, ""),
          api.readOverview(initialRepository.path, theme),
          api.branches(initialRepository.path),
          api.commits(initialRepository.path),
        ]).catch((reason: unknown) => recordError(String(reason)));
        window.setTimeout(() => { void api.repositoryStats(initialRepository.path).catch(() => undefined); }, 800);
      }
      void api.refreshRepos().then((repositories) => {
        if (!repositories.length) return;
        setBootstrap((currentState) => currentState ? { ...currentState, repos: repositories } : currentState);
        setSelectedRepo((currentRepository) => repositories.find((repository) => repository.path === currentRepository?.path) ?? repositories[0]);
      }).catch((reason: unknown) => recordError(String(reason)));
    }).catch((reason: unknown) => recordError(String(reason)));
  }, [recordError]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("reaper-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!bootstrap) return;
    document.documentElement.style.setProperty("--glow", String(bootstrap.config.glow));
    document.documentElement.style.setProperty("--radius", `${bootstrap.config.radius}px`);
    document.documentElement.style.setProperty("--glass", String(bootstrap.config.glass));
    document.documentElement.style.setProperty("--glass-opacity", `${Math.round(bootstrap.config.glass * 100)}%`);
  }, [bootstrap]);

  // updateTheme applies and persists a theme chosen from the desktop chrome.
  function updateTheme(nextTheme: ThemeName) {
    setTheme(nextTheme);
    if (bootstrap) api.updateConfig({ ...bootstrap.config, theme: nextTheme }).then(setBootstrap).catch((reason: unknown) => recordError(String(reason)));
  }

  const commands = useMemo<AppCommand[]>(() => [
    ...destinations.map((destination) => ({ id: `view.${destination.name}`, label: `Open ${destination.label}`, detail: "Navigate", keys: [destination.key], icon: destination.icon, run: () => setView(destination.name) })),
    ...(selectedRepo?.path ? [{ id: "repository.editor", label: "Open repository in editor", detail: selectedRepo.name, keys: ["E"], icon: Braces, run: () => { api.openInEditor(selectedRepo.path, ""); } }] : []),
    { id: "repository.github", label: "Open repository on GitHub", detail: selectedRepo?.fullName ?? "No GitHub remote", keys: ["G"], icon: GitPullRequestArrow, run: () => { if (selectedRepo?.githubUrl) api.openOnGitHub(selectedRepo); } },
    { id: "help.shortcuts", label: "Show keyboard shortcuts", detail: "Help", keys: ["?"], icon: Keyboard, run: () => setShortcutsOpen(true) },
  ], [selectedRepo]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); return; }
      if (modifier && event.key === ",") { event.preventDefault(); setView("settings"); return; }
      if (event.key === "Escape") { setCommandOpen(false); setShortcutsOpen(false); return; }
      if (isEditingTarget(event.target) || modifier || event.altKey) return;
      const destination = destinations.find((candidate) => candidate.key === event.key);
      if (destination) { event.preventDefault(); setView(destination.name); return; }
      if (event.key.toLowerCase() === "e" && selectedRepo?.path) { event.preventDefault(); api.openInEditor(selectedRepo.path, ""); return; }
      if (event.key.toLowerCase() === "g" && selectedRepo?.githubUrl) { event.preventDefault(); api.openOnGitHub(selectedRepo); return; }
      if (event.key.toLowerCase() === "c" && selectedRepo && !selectedRepo.path && selectedRepo.githubUrl) { event.preventDefault(); void cloneRemoteRepository(selectedRepo).catch((reason: unknown) => recordError(String(reason))); return; }
      if (event.key === "?") { event.preventDefault(); setShortcutsOpen(true); }
    }
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [selectedRepo, cloneRemoteRepository, recordError]);

  if (!splashReady) return <Splash onComplete={() => { localStorage.setItem("abduction-splash-seen", String(Date.now())); setSplashReady(true); }} />;
  if (!bootstrap) return <Loading error={error} />;
  return (
    <div className={bootstrap.platform === "macOS" ? "shell shell--mac" : "shell"}>
      <Titlebar version={bootstrap.version} platform={bootstrap.platform} repos={bootstrap.repos} selectedRepo={selectedRepo} onSelect={setSelectedRepo} onCloned={(repository) => { setSelectedRepo(repository); api.refreshRepos().then((repositories) => setBootstrap({ ...bootstrap, repos: repositories })).catch((reason: unknown) => recordError(String(reason))); }} onCommand={() => setCommandOpen(true)} onShortcuts={() => setShortcutsOpen(true)} onError={recordError} />
      <Rail view={view} onView={setView} errorCount={logs.length} />
      <main className="workspace">
        <WorkspaceHeader repo={selectedRepo} onClone={cloneRemoteRepository} onRefresh={refreshActiveRepository} onError={recordError} />
        {view === "themes" ? <ThemeSwitcher theme={theme} onTheme={updateTheme} /> : view === "logs" ? <LogsView logs={logs} onClear={() => setLogs([])} /> : view === "settings" ? <SettingsView bootstrap={bootstrap} onSaved={(nextBootstrap) => { setBootstrap(nextBootstrap); setTheme(nextBootstrap.config.theme); setSelectedRepo(nextBootstrap.repos.find((repository) => repository.path === selectedRepo?.path) ?? nextBootstrap.repos[0] ?? null); }} onError={recordError} /> : !selectedRepo ? <EmptyWorkspace workspace={bootstrap.config.workspace} onSetup={() => { setEmptySetupDismissed(false); setGuideOpen(true); }} onSettings={() => setView("settings")} /> : !selectedRepo.path && view !== "code" ? <RemoteRepositoryNotice repo={selectedRepo} /> : view === "code" ?
          <CodeView key={`${selectedRepo.path || selectedRepo.fullName}-${theme}-${repositoryEpoch}`} repo={selectedRepo} theme={theme} onError={recordError} /> : view === "history" ?
          <HistoryView key={`${selectedRepo.path}-${repositoryEpoch}`} repo={selectedRepo} onError={recordError} /> : view === "stats" ?
          <StatsView key={`${selectedRepo.path}-${repositoryEpoch}`} repo={selectedRepo} onError={recordError} /> :
          view === "reviews" ? <ReviewsView key={`${selectedRepo.path}-${repositoryEpoch}`} repo={selectedRepo} onError={recordError} /> :
          view === "security" ? <SecurityView key={`${selectedRepo.path}-${repositoryEpoch}`} repo={selectedRepo} onError={recordError} /> :
          view === "analysis" ? <AnalysisView key={`${selectedRepo.path}-${repositoryEpoch}`} repo={selectedRepo} tools={bootstrap.tools} onError={recordError} /> :
          <ToolsView tools={bootstrap.tools} />}
      </main>
      {commandOpen ? <CommandPalette commands={commands} onClose={() => setCommandOpen(false)}/> : null}
      {shortcutsOpen ? <ShortcutHelp onClose={() => setShortcutsOpen(false)}/> : null}
      {guideOpen || (!emptySetupDismissed && bootstrap.repos.length === 0) ? <FirstRunGuide setupRequired={bootstrap.repos.length === 0} workspace={bootstrap.config.workspace} onBrowse={() => api.selectWorkspace()} onConnect={async (workspace) => { const nextBootstrap = await api.updateConfig({ ...bootstrap.config, workspace }); if (nextBootstrap.error) throw new Error(nextBootstrap.error); setBootstrap(nextBootstrap); setSelectedRepo(nextBootstrap.repos[0] ?? null); return nextBootstrap.repos.length; }} onClose={() => { localStorage.setItem("abduction-guide-seen", "1"); setGuideOpen(false); setEmptySetupDismissed(true); }}/> : null}
    </div>
  );
}

// CommandPalette makes every registered application action searchable and keyboard reachable.
function CommandPalette({ commands, onClose }: { commands: AppCommand[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery ? commands.filter((command) => `${command.label} ${command.detail}`.toLowerCase().includes(normalizedQuery)) : commands;
  }, [commands, query]);
  useEffect(() => { setActiveIndex(0); }, [query]);
  function runCommand(command: AppCommand) { command.run(); onClose(); }
  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((currentIndex) => (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + filteredCommands.length) % Math.max(filteredCommands.length, 1)); }
    if (event.key === "Enter" && filteredCommands[activeIndex]) { event.preventDefault(); runCommand(filteredCommands[activeIndex]); }
  }
  return <div className="command-backdrop" onMouseDown={onClose}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}><header><Command size={18}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKey} placeholder="Type a command…" aria-label="Search commands"/><kbd>esc</kbd></header><div className="command-list" role="listbox">{filteredCommands.map((command, commandIndex) => <button key={command.id} role="option" aria-selected={commandIndex === activeIndex} className={commandIndex === activeIndex ? "command-item command-item--active" : "command-item"} onMouseEnter={() => setActiveIndex(commandIndex)} onClick={() => runCommand(command)}><span className="command-item__icon"><command.icon size={17}/></span><span><strong>{command.label}</strong><small>{command.detail}</small></span><span className="command-keys">{command.keys.map((key) => <kbd key={key}>{key}</kbd>)}</span></button>)}{!filteredCommands.length ? <div className="command-empty">No matching command</div> : null}</div><footer><span><kbd>↑↓</kbd> select</span><span><kbd>↵</kbd> run</span><span>{filteredCommands.length} commands</span></footer></section></div>;
}

// ShortcutHelp keeps the complete keyboard model discoverable inside the application.
function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const groups = [
    { label: "Navigate", shortcuts: [["1–9", "Open primary view"], ["0", "Open settings"], ["⌘/Ctrl K", "Command palette"], ["⌘/Ctrl P", "Repository switcher"], ["[  ]", "Previous / next repository"]] },
    { label: "Work", shortcuts: [["/", "Focus repository search"], ["J K / ↑ ↓", "Move through items"], ["Enter", "Open or run selected item"], ["← →", "Collapse or expand folder"], ["Esc", "Close the active layer"]] },
  ];
  return <div className="command-backdrop" onMouseDown={onClose}><section className="shortcut-help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Input system</span><h2>Move at thought speed</h2></div><button onClick={onClose} aria-label="Close shortcut help">×</button></header><div>{groups.map((group) => <article key={group.label}><h3>{group.label}</h3>{group.shortcuts.map(([keys, label]) => <div key={keys}><kbd>{keys}</kbd><span>{label}</span></div>)}</article>)}</div><footer>Shortcuts pause automatically while you type in a field.</footer></section></div>;
}

function UfoLoader({ label }: { label: string }) {
  return <div className="ufo-loader" role="status" aria-label={label}><span className="ufo-loader__craft"><i/><b/></span><span>{label}</span></div>;
}

function Loading({ error }: { error: string }) {
  return <main className="loading"><AlienGlyph/><h1>abduction</h1>{error ? <p>{error}</p> : <UfoLoader label="scanning your workspace…"/>}</main>;
}

// Titlebar provides a native draggable strip for the frameless window.
function Titlebar({ version, platform, repos, selectedRepo, onSelect, onCloned, onCommand, onShortcuts, onError }: { version: string; platform: string; repos: Repo[]; selectedRepo: Repo | null; onSelect: (repo: Repo) => void; onCloned: (repo: Repo) => void; onCommand: () => void; onShortcuts: () => void; onError: (message: string) => void }) {
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
function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

// Rail keeps primary destinations stable while contextual content drills in beside it.
function Rail({ view, onView, errorCount }: { view: ViewName; onView: (view: ViewName) => void; errorCount: number }) {
  return <nav className="rail" aria-label="Primary navigation"><div className="rail__brand">R</div>{destinations.map((destination) =>
    <button key={destination.name} className={view === destination.name ? "rail__item rail__item--active" : "rail__item"} onClick={() => onView(destination.name)} aria-label={`${destination.label} (${destination.key})`} aria-current={view === destination.name ? "page" : undefined} data-label={destination.key}><destination.icon className="rail__icon" strokeWidth={1.7}/><span className="rail__label">{destination.label}</span>{destination.name === "logs" && errorCount ? <b className="rail__badge">{Math.min(errorCount, 99)}</b> : null}</button>)}<div className="rail__spacer"/></nav>;
}

// WorkspaceHeader shows repository context and global appearance controls.
function WorkspaceHeader({ repo, onClone, onRefresh, onError }: { repo: Repo | null; onClone: (repository: Repo) => Promise<void>; onRefresh: () => Promise<void>; onError: (message: string) => void }) {
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

function RemoteRepositoryNotice({ repo }: { repo: Repo }) {
  return <section className="empty panel"><div className="repo__glyph">☁</div><h2>Remote repository</h2><p>{repo.fullName} is open in read-only mode. Browse its files under Code, or clone it to unlock local history, analysis, security, and tooling.</p></section>;
}

// ThemeSwitcher previews and applies complete visual bundles like a desktop theme picker.
function ThemeSwitcher({ theme, onTheme }: { theme: ThemeName; onTheme: (theme: ThemeName) => void }) {
  // previewTheme applies a temporary bundle while the user explores the gallery.
  function previewTheme(previewName: ThemeName) { document.documentElement.dataset.theme = previewName; }
  // restoreTheme returns to the saved bundle when a preview loses focus.
  function restoreTheme() { document.documentElement.dataset.theme = theme; }
  return <section className="theme-switcher"><header><div><span className="eyebrow">Visual system</span><h2>Choose an atmosphere</h2><p>Each bundle changes the chrome, code canvas, syntax palette, glow, selection, surfaces, and shadows together.</p></div><span className="theme-count">{themes.length} themes</span></header><div className="theme-gallery">{themes.map((themeOption) => <button key={themeOption.name} className={theme === themeOption.name ? "theme-card theme-card--active" : "theme-card"} onMouseEnter={() => previewTheme(themeOption.name)} onMouseLeave={restoreTheme} onFocus={() => previewTheme(themeOption.name)} onBlur={restoreTheme} onClick={() => onTheme(themeOption.name)}><div className="theme-preview" style={{ background: themeOption.palette[0] }}><span className="theme-preview__rail" style={{ background: themeOption.palette[0], borderColor: themeOption.palette[1] }}/><span className="theme-preview__header" style={{ background: themeOption.palette[0], borderColor: themeOption.palette[1] }}/><span className="theme-preview__code"><i style={{ background: themeOption.palette[1] }}/><i style={{ background: themeOption.palette[2] }}/><i style={{ background: themeOption.palette[3] }}/><i style={{ background: themeOption.palette[1] }}/></span><span className="theme-preview__glow" style={{ background: themeOption.palette[2] }}/></div><footer><strong>{themeOption.label}</strong><span className="theme-swatches">{themeOption.palette.slice(1).map((paletteColour) => <i key={paletteColour} style={{ background: paletteColour }}/>)}</span>{theme === themeOption.name ? <small>Active</small> : null}</footer></button>)}</div></section>;
}

// LogsView presents retained application failures away from the working canvas.
function LogsView({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const logText = logs.map((entry) => `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`).join("\n");
  // copyLogs copies the current diagnostic history for issue reports.
  function copyLogs() { if (logText) navigator.clipboard.writeText(logText); }
  return <section className="logs-view"><header><div><span className="eyebrow">Application diagnostics</span><h2>Event log</h2><p>Failures are retained here instead of being injected into your code workspace.</p></div><div><button className="ghost" disabled={!logs.length} onClick={copyLogs}>Copy log</button><button className="ghost" disabled={!logs.length} onClick={onClear}>Clear</button></div></header><div className="log-stream">{logs.length ? logs.map((entry) => <article className="log-entry" key={entry.id}><time>{new Date(entry.timestamp).toLocaleTimeString()}</time><span>{entry.level}</span><p>{entry.message}</p></article>) : <div className="log-empty"><ScrollText size={30}/><h3>All quiet</h3><p>No application errors have been recorded in this session.</p></div>}</div></section>;
}

// SettingsView edits the same JSON configuration loaded during application startup.
function SettingsView({ bootstrap, onSaved, onError }: { bootstrap: Bootstrap; onSaved: (bootstrap: Bootstrap) => void; onError: (message: string) => void }) {
  const [draft, setDraft] = useState(bootstrap.config);
  const [configPath, setConfigPath] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.configPath().then(setConfigPath).catch((reason: unknown) => onError(String(reason))); }, [onError]);
  useEffect(() => {
    document.documentElement.dataset.theme = draft.theme;
    document.documentElement.style.setProperty("--glow", String(draft.glow));
    document.documentElement.style.setProperty("--radius", `${draft.radius}px`);
    document.documentElement.style.setProperty("--glass", String(draft.glass));
    document.documentElement.style.setProperty("--glass-opacity", `${Math.round(draft.glass * 100)}%`);
  }, [draft]);

  // saveSettings validates preferences in Go and refreshes repository discovery.
  function saveSettings() {
    setSaving(true);
    api.updateConfig(draft).then(onSaved).catch((reason: unknown) => onError(String(reason))).finally(() => setSaving(false));
  }

  return <section className="settings-view"><header><span className="eyebrow">Desktop foundation</span><h2>Make Abduction yours</h2><p>Appearance changes preview live. Save writes the same portable JSON configuration used at startup.</p></header><div className="settings-grid"><article className="settings-card"><div className="settings-card__head"><span>01</span><div><h3>Environment</h3><p>Connect Abduction to your local development setup.</p></div></div><label><span>Repository workspace</span><input value={draft.workspace} onChange={(event) => setDraft({ ...draft, workspace: event.target.value })}/></label><label><span>Editor command</span><input value={draft.editor} onChange={(event) => setDraft({ ...draft, editor: event.target.value })}/></label></article><article className="settings-card settings-card--appearance"><div className="settings-card__head"><span>02</span><div><h3>Atmosphere</h3><p>Tune the cockpit rather than accepting one fixed skin.</p></div></div><label><span>Colour system</span><select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as ThemeName })}>{themes.map((themeOption) => <option key={themeOption.name} value={themeOption.name}>{themeOption.label}</option>)}</select></label><label className="range-field"><span>Underglow <output>{draft.glow.toFixed(1)}×</output></span><input type="range" min="0.5" max="2.5" step="0.1" value={draft.glow} onChange={(event) => setDraft({ ...draft, glow: Number(event.target.value) })}/></label><label className="range-field"><span>Corner softness <output>{draft.radius}px</output></span><input type="range" min="10" max="28" step="1" value={draft.radius} onChange={(event) => setDraft({ ...draft, radius: Number(event.target.value) })}/></label><label className="range-field"><span>Glass depth <output>{Math.round(draft.glass * 100)}%</output></span><input type="range" min="0.55" max="0.96" step="0.01" value={draft.glass} onChange={(event) => setDraft({ ...draft, glass: Number(event.target.value) })}/></label></article></div><footer><div><span className="eyebrow">Configuration file</span><code>{configPath || "resolving…"}</code></div><button className="primary" disabled={saving} onClick={saveSettings}>{saving ? "Saving…" : "Save configuration"}</button></footer></section>;
}

// EmptyWorkspace explains how to point Abduction at local checkouts.
function EmptyWorkspace({ workspace, onSetup, onSettings }: { workspace: string; onSetup: () => void; onSettings: () => void }) {
  return <section className="empty panel"><div className="reaper-mark">A</div><h2>No repositories in range</h2><p>Abduction looks for Git checkouts directly inside:</p><code>{workspace}</code><p>Connect another parent folder, or continue with this workspace and clone a repository from the repository picker.</p><div className="empty-actions"><button className="primary" onClick={onSetup}>Choose workspace</button><button className="ghost" onClick={onSettings}>Open settings</button></div></section>;
}
