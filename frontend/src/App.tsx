import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Braces, Command, GitPullRequestArrow, Keyboard, type LucideIcon } from "lucide-react";
import { api } from "./api";
import type { Bootstrap, Repo, ThemeName, ViewName } from "./types";
import { FirstRunGuide } from "./components/FirstRunGuide";
import { Splash } from "./components/Splash";
import { CodeView } from "./features/code/CodeView";
import { HistoryView, ReviewsView, StatsView } from "./features/repository/RepositoryViews";
import { AnalysisView, SecurityView, ToolsView } from "./features/operations/OperationViews";
import { EmptyWorkspace, LogsView, SettingsView, ThemeSwitcher, themes, type LogEntry } from "./features/settings/SettingsViews";
import { Loading, Rail, RemoteRepositoryNotice, Titlebar, WorkspaceHeader, destinations, isEditingTarget } from "./features/shell/Shell";

type AppCommand = { id: string; label: string; detail: string; keys: string[]; icon: LucideIcon; run: () => void };

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
