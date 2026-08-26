import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, BrainCircuit, Braces, Command, GitBranch, GitPullRequestArrow, Keyboard, Palette, ScrollText, Settings2, ShieldCheck, Wrench, type LucideIcon } from "lucide-react";
import { api } from "./api";
import type { Bootstrap, Commit, Document, InstallCommand, PullRequest, Repo, RepositoryStats, SearchResult, ThemeName, TreeEntry, ViewName } from "./types";
import type { AnalysisEvent, ScanEvent, ScannerInfo } from "./types";
import { EventsOn } from "../wailsjs/runtime/runtime";

const themes: { name: ThemeName; label: string; palette: string[] }[] = [
  { name: "reaper-dark", label: "Abduction Night", palette: ["#050713", "#315cff", "#19d9ff", "#a449ff"] },
  { name: "reaper-blood", label: "Abduction Signal", palette: ["#080308", "#ff315f", "#ff784f", "#a84dff"] },
  { name: "reaper-void", label: "Abduction Void", palette: ["#020106", "#7a3cff", "#00e5ff", "#e349ff"] },
  { name: "tokyo-night", label: "Tokyo Night", palette: ["#1a1b26", "#7aa2f7", "#bb9af7", "#9ece6a"] },
  { name: "tokyo-neon", label: "Tokyo Neon", palette: ["#080b18", "#2ac3ff", "#ff3dbb", "#adff2f"] },
  { name: "tokyo-dusk", label: "Tokyo Dusk", palette: ["#171522", "#8b7cff", "#ff7eb6", "#ffc66d"] },
  { name: "matte-black", label: "Matte Black", palette: ["#090909", "#e68e0d", "#bebebe", "#b91c1c"] },
  { name: "matte-ember", label: "Matte Ember", palette: ["#070605", "#ff7a18", "#ffd166", "#db2b39"] },
  { name: "matte-ice", label: "Matte Ice", palette: ["#050708", "#83e9ff", "#d7f6ff", "#5773ff"] },
  { name: "hackerman", label: "Hackerman", palette: ["#06060c", "#50f872", "#7cf8f7", "#829dd4"] },
  { name: "hackerman-amber", label: "Hackerman Amber", palette: ["#070603", "#ffbf36", "#ffef9a", "#ff6b2c"] },
  { name: "hackerman-ghost", label: "Hackerman Ghost", palette: ["#020807", "#2fffc1", "#b8fff1", "#00a8ff"] },
];

type LogEntry = { id: number; timestamp: string; level: "error"; message: string };
type AppCommand = { id: string; label: string; detail: string; keys: string[]; icon: LucideIcon; run: () => void };

const destinations: { name: ViewName; label: string; key: string; icon: LucideIcon }[] = [
  { name: "code", label: "Code", key: "1", icon: Braces }, { name: "history", label: "History", key: "2", icon: GitBranch }, { name: "stats", label: "Stats", key: "3", icon: BarChart3 },
  { name: "reviews", label: "Reviews", key: "4", icon: GitPullRequestArrow }, { name: "security", label: "Security", key: "5", icon: ShieldCheck }, { name: "analysis", label: "Analysis", key: "6", icon: BrainCircuit },
  { name: "tools", label: "Tools", key: "7", icon: Wrench }, { name: "themes", label: "Themes", key: "8", icon: Palette }, { name: "logs", label: "Logs", key: "9", icon: ScrollText }, { name: "settings", label: "Settings", key: "0", icon: Settings2 },
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
  const [splashReady, setSplashReady] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // recordError retains actionable failures in the diagnostic workspace.
  const recordError = useCallback((message: string) => {
    const normalizedMessage = message.trim() || "Unknown application error";
    setError(normalizedMessage);
    setLogs((currentLogs) => [...currentLogs.slice(-249), { id: Date.now() + currentLogs.length, timestamp: new Date().toISOString(), level: "error", message: normalizedMessage }]);
  }, []);

  useEffect(() => {
    api.bootstrap().then((initialState) => {
      setBootstrap(initialState);
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
    }).catch((reason: unknown) => recordError(String(reason)));
  }, [recordError]);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setSplashReady(true), 3400);
    return () => window.clearTimeout(splashTimer);
  }, []);

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
    { id: "repository.editor", label: "Open repository in editor", detail: selectedRepo?.name ?? "No repository selected", keys: ["E"], icon: Braces, run: () => { if (selectedRepo) api.openInEditor(selectedRepo.path, ""); } },
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
      if (event.key.toLowerCase() === "e" && selectedRepo) { event.preventDefault(); api.openInEditor(selectedRepo.path, ""); return; }
      if (event.key.toLowerCase() === "g" && selectedRepo?.githubUrl) { event.preventDefault(); api.openOnGitHub(selectedRepo); return; }
      if (event.key === "?") { event.preventDefault(); setShortcutsOpen(true); }
    }
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [selectedRepo]);

  if (!splashReady) return <Splash />;
  if (!bootstrap) return <Loading error={error} />;
  return (
    <div className="shell">
      <Titlebar version={bootstrap.version} platform={bootstrap.platform} repos={bootstrap.repos} selectedRepo={selectedRepo} onSelect={setSelectedRepo} onCloned={(repository) => { setSelectedRepo(repository); api.refreshRepos().then((repositories) => setBootstrap({ ...bootstrap, repos: repositories })).catch((reason: unknown) => recordError(String(reason))); }} onCommand={() => setCommandOpen(true)} onShortcuts={() => setShortcutsOpen(true)} onError={recordError} />
      <Rail view={view} onView={setView} errorCount={logs.length} />
      <main className="workspace">
        <WorkspaceHeader repo={selectedRepo} />
        {view === "themes" ? <ThemeSwitcher theme={theme} onTheme={updateTheme} /> : view === "logs" ? <LogsView logs={logs} onClear={() => setLogs([])} /> : view === "settings" ? <SettingsView bootstrap={bootstrap} onSaved={(nextBootstrap) => { setBootstrap(nextBootstrap); setTheme(nextBootstrap.config.theme); setSelectedRepo(nextBootstrap.repos.find((repository) => repository.path === selectedRepo?.path) ?? nextBootstrap.repos[0] ?? null); }} onError={recordError} /> : !selectedRepo ? <EmptyWorkspace workspace={bootstrap.config.workspace} /> : view === "code" ?
          <CodeView key={`${selectedRepo.path}-${theme}`} repo={selectedRepo} theme={theme} onError={recordError} /> : view === "history" ?
          <HistoryView key={selectedRepo.path} repo={selectedRepo} onError={recordError} /> : view === "stats" ?
          <StatsView key={selectedRepo.path} repo={selectedRepo} onError={recordError} /> :
          view === "reviews" ? <ReviewsView key={selectedRepo.path} repo={selectedRepo} onError={recordError} /> :
          view === "security" ? <SecurityView key={selectedRepo.path} repo={selectedRepo} onError={recordError} /> :
          view === "analysis" ? <AnalysisView key={selectedRepo.path} repo={selectedRepo} tools={bootstrap.tools} onError={recordError} /> :
          <ToolsView tools={bootstrap.tools} />}
      </main>
      {commandOpen ? <CommandPalette commands={commands} onClose={() => setCommandOpen(false)}/> : null}
      {shortcutsOpen ? <ShortcutHelp onClose={() => setShortcutsOpen(false)}/> : null}
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

type AbductionTarget = "code" | "cow" | "person";
const abductionTargets: AbductionTarget[] = ["code", "cow", "person"];
const abducteeArt: Record<AbductionTarget, string> = {
  code: "  </>   { }   01  ",
  cow: "  (__ )  /\\\n  (oo) /  \\\n /|  |/    \\\n  || ||",
  person: "    O\n   /|\\\n   / \\",
};

// Splash chooses a new close-encounter vignette on every application launch.
function Splash() {
  const [target] = useState<AbductionTarget>(() => abductionTargets[Math.floor(Math.random() * abductionTargets.length)]);
  return <main className="splash splash--ascii" aria-label={`Starting Abduction: abducting ${target}`}>
    <div className="ascii-stars" aria-hidden>{".       *           +       .       *\n      .       +        .      *         .\n  *        .       ·       +       ."}</div>
    <pre className="ascii-moon" aria-hidden>{"  ▄██▄\n █░░░█\n  ▀██▀"}</pre>
    <pre className="ascii-craft" aria-hidden>{"          .--------.\n      ___/==========\\___\n  ___/___[::•::•::•::]___\\___\n <___________/\\___________>\n       ▀  ▀  ▀  ▀  ▀"}</pre>
    <div className="ascii-beam" aria-hidden><span>{"░▒▓█▓▒░"}</span><span>{"░▒▓█▓▒░"}</span><span>{"░▒▓█▓▒░"}</span><span>{"░▒▓█▓▒░"}</span></div>
    <pre className={`ascii-target ascii-target--${target}`} aria-hidden>{abducteeArt[target]}</pre>
    <pre className="ascii-woods" aria-hidden>{"    /\\       /\\    /\\          /\\       /\\\n /\\/  \\ /\\ /  \\  /  \\ /\\  /  \\ /\\ /  \\\n/  \\  /  \\  /\\  \/  /  \\  \/  /  \\  /\\  \\\n|||||||||||||||||||||||||||||||||||||||||||||||||||"}</pre>
    <div className="splash__identity"><h1>[ ABDUCTION ]</h1><p>{target === "code" ? "YOUR CODE HAS BEEN SELECTED" : `${target.toUpperCase()} ENCOUNTER IN PROGRESS`}</p><span>&gt; establishing repository contact_</span></div>
  </main>;
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
  const [cloning, setCloning] = useState(false);
  const [activeRepoIndex, setActiveRepoIndex] = useState(0);
  const filteredRepos = useMemo(() => {
    const normalizedQuery = pickerQuery.trim().toLowerCase();
    return normalizedQuery ? repos.filter((repository) => repository.fullName.toLowerCase().includes(normalizedQuery)) : repos;
  }, [pickerQuery, repos]);

  useEffect(() => { setActiveRepoIndex(0); }, [pickerQuery, pickerOpen]);

  useEffect(() => {
    if (!selectedRepo) { setBranches([]); return; }
    api.branches(selectedRepo.path).then(setBranches).catch(() => setBranches([]));
  }, [selectedRepo]);

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
  function chooseRepository(repository: Repo) { onSelect(repository); setPickerOpen(false); setPickerQuery(""); }

  // chooseBranch checks out a known branch and refreshes the active repository context.
  function chooseBranch(branch: string) {
    if (!selectedRepo || branch === selectedRepo.branch) return;
    setSwitchingBranch(true);
    api.switchBranch(selectedRepo.path, branch).then((resolvedBranch) => onSelect({ ...selectedRepo, branch: resolvedBranch })).finally(() => setSwitchingBranch(false));
  }

  // cloneRepository adds a remote checkout to the configured workspace.
  function cloneRepository() {
    const repositoryURL = cloneURL.trim();
    if (!repositoryURL || cloning) return;
    setCloning(true);
    api.cloneRepository(repositoryURL).then((repository) => { onCloned(repository); setCloneURL(""); setPickerOpen(false); }).catch((reason: unknown) => onError(String(reason))).finally(() => setCloning(false));
  }

  function handlePickerKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveRepoIndex((currentIndex) => (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + filteredRepos.length) % Math.max(filteredRepos.length, 1)); }
    if (event.key === "Enter" && filteredRepos[activeRepoIndex]) { event.preventDefault(); chooseRepository(filteredRepos[activeRepoIndex]); }
  }

  return <><header className="titlebar"><BrandIdentity/><div className="top-context"><button className="repo-picker" onClick={() => setPickerOpen(true)}><span>Repository</span><strong>{selectedRepo?.fullName ?? "Select a repository"}</strong><kbd>⌘P</kbd></button><label className="branch-picker"><GitBranch size={15}/><select disabled={!selectedRepo || switchingBranch} value={selectedRepo?.branch ?? ""} onChange={(event) => chooseBranch(event.target.value)} aria-label="Branch">{selectedRepo?.branch && !branches.includes(selectedRepo.branch) ? <option value={selectedRepo.branch}>{selectedRepo.branch}</option> : null}{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label></div><div className="titlebar__actions"><button onClick={onCommand} aria-label="Open command palette"><Command size={15}/><kbd>⌘K</kbd></button><button onClick={onShortcuts} aria-label="Show keyboard shortcuts"><Keyboard size={16}/></button><small>{platform} · v{version}</small></div></header>{pickerOpen ? <div className="picker-backdrop" onMouseDown={() => setPickerOpen(false)}><section className="picker" role="dialog" aria-modal="true" aria-label="Open repository" onMouseDown={(event) => event.stopPropagation()}><header><span className="eyebrow">Quick switch</span><h2>Open repository</h2></header><input autoFocus value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} onKeyDown={handlePickerKey} placeholder="Search owner or repository…"/><div className="picker__list" role="listbox">{filteredRepos.map((repository, repositoryIndex) => <button key={repository.path} role="option" aria-selected={repositoryIndex === activeRepoIndex} className={repositoryIndex === activeRepoIndex ? "picker__option--active" : ""} onMouseEnter={() => setActiveRepoIndex(repositoryIndex)} onClick={() => chooseRepository(repository)}><span className="repo__glyph">⌁</span><span><strong>{repository.name}</strong><small>{repository.owner} · {repository.language}</small></span><kbd>{repository.branch || "detached"}</kbd></button>)}</div><div className="clone-box"><div><span className="eyebrow">Add to workspace</span><strong>Clone from URL</strong></div><div><input value={cloneURL} onChange={(event) => setCloneURL(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") cloneRepository(); }} placeholder="https://github.com/owner/repository.git"/><button className="primary" disabled={!cloneURL.trim() || cloning} onClick={cloneRepository}>{cloning ? "Cloning…" : "Clone"}</button></div></div><footer><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></footer></section></div> : null}</>;
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
    <button key={destination.name} className={view === destination.name ? "rail__item rail__item--active" : "rail__item"} onClick={() => onView(destination.name)} aria-label={`${destination.label} (${destination.key})`} aria-current={view === destination.name ? "page" : undefined} data-label={`${destination.label}  ${destination.key}`}><destination.icon className="rail__icon" strokeWidth={1.7}/><span className="rail__label">{destination.label}</span>{destination.name === "logs" && errorCount ? <b className="rail__badge">{Math.min(errorCount, 99)}</b> : null}</button>)}<div className="rail__spacer"/></nav>;
}

// WorkspaceHeader shows repository context and global appearance controls.
function WorkspaceHeader({ repo }: { repo: Repo | null }) {
  return <header className="workspace__header"><div>{repo ? <><span className="eyebrow">{repo.language}</span><h1>{repo.name}</h1></> : <h1>Choose a repository</h1>}</div><div className="header-actions">{repo ? <button className="ghost" onClick={() => api.openInEditor(repo.path, "")}>Open editor</button> : null}{repo?.githubUrl ? <button className="primary" onClick={() => api.openOnGitHub(repo)}>GitHub ↗</button> : null}</div></header>;
}

// CodeView combines a lazy file browser with the rich document reader.
function CodeView({ repo, theme, onError }: { repo: Repo; theme: ThemeName; onError: (message: string) => void }) {
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [childrenByPath, setChildrenByPath] = useState<Record<string, TreeEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"files" | "content">("files");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [findQuery, setFindQuery] = useState("");
  const [findLine, setFindLine] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [treeVisible, setTreeVisible] = useState(true);
  const treeRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.listDirectory(repo.path, ""), api.readOverview(repo.path, theme)]).then(([rootEntries, overview]) => { setEntries(rootEntries); setDocument(overview); setLoading(false); }).catch((reason: unknown) => onError(String(reason)));
  }, [repo.path, theme, onError]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) { setSearchResults([]); return; }
    const searchRequest = searchMode === "files" ? api.searchRepositoryFiles : api.searchRepository;
    const searchTimer = window.setTimeout(() => searchRequest(repo.path, trimmedQuery).then(setSearchResults).catch((reason: unknown) => onError(String(reason))), 180);
    return () => window.clearTimeout(searchTimer);
  }, [repo.path, searchQuery, searchMode, onError]);

  useEffect(() => {
    // handleFocusEscape returns from the immersive reader without changing files.
    function handleFocusEscape(event: KeyboardEvent) { if (event.key === "Escape" && focusMode) setFocusMode(false); }
    window.addEventListener("keydown", handleFocusEscape);
    return () => window.removeEventListener("keydown", handleFocusEscape);
  }, [focusMode]);

  useEffect(() => {
    function handleCodeShortcut(event: KeyboardEvent) {
      if (isEditingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "/") { event.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", handleCodeShortcut);
    return () => window.removeEventListener("keydown", handleCodeShortcut);
  }, []);

  // openEntry expands folders in place or renders the selected file.
  function openEntry(entry: TreeEntry) {
    if (entry.kind === "directory") {
      const nextExpandedPaths = new Set(expandedPaths);
      if (nextExpandedPaths.has(entry.path)) nextExpandedPaths.delete(entry.path);
      else nextExpandedPaths.add(entry.path);
      setExpandedPaths(nextExpandedPaths);
      if (!childrenByPath[entry.path]) api.listDirectory(repo.path, entry.path).then((children) => setChildrenByPath((currentChildren) => ({ ...currentChildren, [entry.path]: children }))).catch((reason: unknown) => onError(String(reason)));
      return;
    }
    setLoading(true);
    api.readFile(repo.path, entry.path, theme).then((nextDocument) => { setDocument(nextDocument); setLoading(false); }).catch((reason: unknown) => { setLoading(false); onError(String(reason)); });
  }

  // openSearchResult renders a matched file while retaining the search results.
  function openSearchResult(searchResult: SearchResult) {
    setLoading(true);
    setFindQuery(searchResult.kind === "content" ? searchQuery.trim() : "");
    setFindLine(searchResult.line);
    api.readFile(repo.path, searchResult.path, theme).then((nextDocument) => { setDocument(nextDocument); setLoading(false); }).catch((reason: unknown) => { setLoading(false); onError(String(reason)); });
  }

  // handleTreeNavigation gives file and search results one predictable keyboard model.
  function handleTreeNavigation(event: React.KeyboardEvent<HTMLElement>) {
    if (isEditingTarget(event.target)) return;
    const items = Array.from(treeRef.current?.querySelectorAll<HTMLButtonElement>("[data-tree-item]") ?? []);
    if (!items.length) return;
    const currentIndex = Math.max(items.indexOf(window.document.activeElement as HTMLButtonElement), 0);
    if (["ArrowDown", "ArrowUp", "j", "k", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (currentIndex + (["ArrowDown", "j"].includes(event.key) ? 1 : -1) + items.length) % items.length;
      items[nextIndex]?.focus(); items[nextIndex]?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); items[currentIndex]?.click(); }
    if (event.key === "ArrowRight" && items[currentIndex]?.dataset.kind === "directory" && items[currentIndex]?.dataset.expanded === "false") { event.preventDefault(); items[currentIndex]?.click(); }
    if (event.key === "ArrowLeft" && items[currentIndex]?.dataset.kind === "directory" && items[currentIndex]?.dataset.expanded === "true") { event.preventDefault(); items[currentIndex]?.click(); }
  }

  const layoutClass = ["code-layout", chatOpen ? "code-layout--chat" : "", focusMode ? "code-layout--focus" : "", focusMode && !treeVisible ? "code-layout--tree-hidden" : ""].filter(Boolean).join(" ");
  return <section className={layoutClass}><aside ref={treeRef} className="tree" onKeyDown={handleTreeNavigation}><div className="tree__title"><span>Explorer</span><small>{searchQuery.trim().length >= 2 ? searchResults.length : entries.length}</small></div><div className="search-modes"><button className={searchMode === "files" ? "search-mode search-mode--active" : "search-mode"} onClick={() => setSearchMode("files")}>Files</button><button className={searchMode === "content" ? "search-mode search-mode--active" : "search-mode"} onClick={() => setSearchMode("content")}>In files</button></div><input ref={searchRef} className="tree__search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setSearchQuery(""); event.currentTarget.blur(); } }} placeholder={searchMode === "files" ? "Find a tracked filename…" : "Search inside tracked files…"} aria-label="Search repository"/>{searchQuery.trim().length >= 2 ? <div className="search-results">{searchResults.map((searchResult) => <button data-tree-item key={`${searchResult.path}:${searchResult.line}`} onClick={() => openSearchResult(searchResult)}><strong>{searchResult.path}</strong><small>{searchResult.kind === "content" ? `line ${searchResult.line}` : "file"}</small><span>{searchResult.kind === "content" ? searchResult.preview : searchResult.preview === "." ? "Repository root" : searchResult.preview}</span></button>)}{!searchResults.length ? <p>No tracked matches.</p> : null}</div> : <><div className="tree__root"><span className="tree__root-mark">⌁</span><strong>{repo.name}</strong><kbd>/</kbd></div><div className="tree__list"><TreeNodes entries={entries} depth={0} expandedPaths={expandedPaths} childrenByPath={childrenByPath} onOpen={openEntry}/></div></>}</aside><article className="reader">{loading ? <div className="reader__loading">rendering…</div> : document ? <DocumentView document={document} repo={repo} findQuery={findQuery} findLine={findLine} onChat={() => setChatOpen(true)} focusMode={focusMode} treeVisible={treeVisible} onFocus={() => setFocusMode(!focusMode)} onTree={() => setTreeVisible(!treeVisible)} /> : null}</article>{chatOpen && document ? <ChatDrawer repo={repo} document={document} onClose={() => setChatOpen(false)} onError={onError}/> : null}</section>;
}

// TreeNodes renders a lazy recursive hierarchy while preserving folder context.
function TreeNodes({ entries, depth, expandedPaths, childrenByPath, onOpen }: { entries: TreeEntry[]; depth: number; expandedPaths: Set<string>; childrenByPath: Record<string, TreeEntry[]>; onOpen: (entry: TreeEntry) => void }) {
  return <>{entries.map((entry) => { const expanded = expandedPaths.has(entry.path); return <div className="tree-node" key={entry.path}><button data-tree-item data-kind={entry.kind} data-expanded={expanded} aria-expanded={entry.kind === "directory" ? expanded : undefined} className={expanded ? "tree__entry tree__entry--expanded" : "tree__entry"} style={{ paddingLeft: `${8 + depth * 15}px` }} onClick={() => onOpen(entry)}><span className={entry.kind === "directory" ? "tree-caret" : "tree-file-mark"}>{entry.kind === "directory" ? (expanded ? "⌄" : "›") : "·"}</span><span>{entry.name}</span>{entry.kind === "file" ? <small>{formatBytes(entry.size)}</small> : null}</button>{entry.kind === "directory" && expanded ? <div className="tree-children"><TreeNodes entries={childrenByPath[entry.path] ?? []} depth={depth + 1} expandedPaths={expandedPaths} childrenByPath={childrenByPath} onOpen={onOpen}/></div> : null}</div>; })}</>;
}

// DocumentView displays trusted HTML and navigates highlighted search matches.
function DocumentView({ document, repo, findQuery, findLine, onChat, focusMode, treeVisible, onFocus, onTree }: { document: Document; repo: Repo; findQuery: string; findLine: number; onChat: () => void; focusMode: boolean; treeVisible: boolean; onFocus: () => void; onTree: () => void }) {
  const documentRoot = useRef<HTMLDivElement>(null);
  const [matches, setMatches] = useState<HTMLElement[]>([]);
  const [activeMatch, setActiveMatch] = useState(0);

  useEffect(() => {
    const rootElement = documentRoot.current;
    if (!rootElement || !findQuery) { setMatches([]); return; }
    const highlightedMatches = markTextMatches(rootElement, findQuery);
    let initialMatch = 0;
    if (findLine > 0) {
      const lineElement = rootElement.querySelector(`#line-${findLine}`);
      const lineRow = lineElement?.closest("tr");
      const lineMatch = highlightedMatches.findIndex((matchElement) => lineRow?.contains(matchElement));
      if (lineMatch >= 0) initialMatch = lineMatch;
    }
    setMatches(highlightedMatches);
    setActiveMatch(initialMatch);
    activateSearchMatch(highlightedMatches, initialMatch);
    return () => highlightedMatches.forEach((matchElement) => { const parentElement = matchElement.parentNode; if (parentElement) parentElement.replaceChild(window.document.createTextNode(matchElement.textContent ?? ""), matchElement); });
  }, [document.html, findQuery, findLine]);

  // moveMatch cycles through highlighted occurrences in either direction.
  function moveMatch(direction: number) {
    if (!matches.length) return;
    const nextMatch = (activeMatch + direction + matches.length) % matches.length;
    setActiveMatch(nextMatch);
    activateSearchMatch(matches, nextMatch);
  }

  return <><header className="reader__head"><div><span className="eyebrow">{document.language}</span><h2>{document.name}</h2></div><div className="reader__meta">{findQuery ? <div className="find-navigation"><strong>{matches.length ? `${activeMatch + 1} / ${matches.length}` : "No matches"}</strong><button onClick={() => moveMatch(-1)} disabled={!matches.length} aria-label="Previous match">↑</button><button onClick={() => moveMatch(1)} disabled={!matches.length} aria-label="Next match">↓</button></div> : null}<span>{document.lines} lines</span><span>{formatBytes(document.size)}</span>{focusMode ? <button className="ghost" onClick={onTree}>{treeVisible ? "Hide tree" : "Show tree"}</button> : null}<button className="ghost chat-button" onClick={onChat}>✣ Ask AI</button><button className="ghost" onClick={onFocus}>{focusMode ? "Exit focus" : "Focus"}</button><button className="ghost" onClick={() => api.openInEditor(repo.path, document.path)}>Edit ↗</button></div></header>{document.binary ? <div className="empty"><h3>Binary file</h3><p>Open this file in your configured editor to inspect it safely.</p></div> : <div ref={documentRoot} className={document.markdown ? "document markdown" : "document code"} dangerouslySetInnerHTML={{ __html: document.html }}/>}</>;
}

// markTextMatches wraps case-insensitive matches without replacing syntax markup.
function markTextMatches(rootElement: HTMLElement, query: string): HTMLElement[] {
  const normalizedQuery = query.toLocaleLowerCase();
  const textWalker = window.document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (textWalker.nextNode()) textNodes.push(textWalker.currentNode as Text);
  const matches: HTMLElement[] = [];
  textNodes.forEach((textNode) => {
    const sourceText = textNode.nodeValue ?? "";
    const normalizedText = sourceText.toLocaleLowerCase();
    let searchOffset = 0;
    let matchOffset = normalizedText.indexOf(normalizedQuery, searchOffset);
    if (matchOffset < 0 || !textNode.parentNode) return;
    const fragment = window.document.createDocumentFragment();
    while (matchOffset >= 0) {
      fragment.append(sourceText.slice(searchOffset, matchOffset));
      const matchElement = window.document.createElement("mark");
      matchElement.className = "code-search-match";
      matchElement.textContent = sourceText.slice(matchOffset, matchOffset + query.length);
      matches.push(matchElement);
      fragment.append(matchElement);
      searchOffset = matchOffset + query.length;
      matchOffset = normalizedText.indexOf(normalizedQuery, searchOffset);
    }
    fragment.append(sourceText.slice(searchOffset));
    textNode.parentNode.replaceChild(fragment, textNode);
  });
  return matches;
}

// activateSearchMatch marks one occurrence active and scrolls it into view.
function activateSearchMatch(matches: HTMLElement[], activeIndex: number) {
  matches.forEach((matchElement, matchIndex) => matchElement.classList.toggle("code-search-match--active", matchIndex === activeIndex));
  matches[activeIndex]?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
}

type ChatMessage = { role: "user" | "assistant"; text: string };

// ChatDrawer keeps the active file visible while Codex or Claude explains it.
function ChatDrawer({ repo, document, onClose, onError }: { repo: Repo; document: Document; onClose: () => void; onError: (message: string) => void }) {
  const [provider, setProvider] = useState("codex");
  const [draft, setDraft] = useState("");
  const [jobID, setJobID] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const unsubscribe = EventsOn("analysis:event", (event: AnalysisEvent) => {
      if (jobID && event.jobId !== jobID) return;
      if (event.kind === "output") {
        const readableText = readableProviderLine(event.text, event.provider);
        if (readableText) setMessages((currentMessages) => appendAssistantOutput(currentMessages, readableText));
      }
      if (event.kind === "finished" || event.kind === "error") {
        setRunning(false);
        if (event.text) setMessages((currentMessages) => appendAssistantOutput(currentMessages, event.text));
      }
    });
    return unsubscribe;
  }, [jobID]);

  // sendMessage attaches the visible file and recent conversation to the question.
  function sendMessage() {
    const question = draft.trim();
    if (!question || running) return;
    const transcript = messages.slice(-8).map((message) => `${message.role}: ${message.text}`).join("\n");
    const contextualPrompt = `You are the read-only learning assistant inside Abduction. Repository: ${repo.fullName}. Branch: ${repo.branch}. The user is viewing ${document.path || document.name} (${document.language}, ${document.lines} lines). Explain clearly and refer to exact files and symbols. Conversation so far:\n${transcript}\n\nUser: ${question}`;
    setMessages((currentMessages) => [...currentMessages, { role: "user", text: question }, { role: "assistant", text: "" }]);
    setDraft("");
    setRunning(true);
    api.startAnalysis(repo.path, provider, contextualPrompt).then(setJobID).catch((reason: unknown) => { setRunning(false); onError(String(reason)); });
  }

  // cancelMessage stops the current provider without discarding the conversation.
  function cancelMessage() {
    if (jobID) api.cancelAnalysis(jobID).catch((reason: unknown) => onError(String(reason)));
  }

  return <aside className="chat-drawer"><header><div><span className="eyebrow">Screen-aware</span><h2>Ask about this code</h2></div><button onClick={onClose} aria-label="Close chat">×</button></header><div className="chat-context"><span>⌁ {repo.name}</span><span>◇ {document.path || document.name}</span></div><div className="chat-messages">{messages.length ? messages.map((message, messageIndex) => <article className={`chat-message chat-message--${message.role}`} key={`${message.role}-${messageIndex}`}><small>{message.role === "user" ? "You" : provider}</small><p>{message.text || (running ? "Thinking…" : "")}</p></article>) : <div className="chat-empty"><span>✣</span><p>Ask what this file does, trace a function, or explain an unfamiliar pattern.</p></div>}</div><footer><div><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="codex">Codex</option><option value="claude">Claude</option></select><button className="ghost" onClick={() => setMessages([])}>New</button></div><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={`Ask about ${document.name}…`} rows={3}/>{running ? <button className="ghost" onClick={cancelMessage}>Cancel</button> : <button className="primary" onClick={sendMessage} disabled={!draft.trim()}>Send</button>}</footer></aside>;
}

// appendAssistantOutput adds streamed text to the current assistant message.
function appendAssistantOutput(messages: ChatMessage[], text: string): ChatMessage[] {
  const nextMessages = [...messages];
  const lastMessage = nextMessages[nextMessages.length - 1];
  if (lastMessage?.role === "assistant") nextMessages[nextMessages.length - 1] = { ...lastMessage, text: `${lastMessage.text}${lastMessage.text ? "\n" : ""}${text}` };
  else nextMessages.push({ role: "assistant", text });
  return nextMessages;
}

// readableProviderLine extracts prose from the common provider JSONL shapes.
function readableProviderLine(line: string, provider: string): string {
  try {
    const parsedLine = JSON.parse(line) as Record<string, unknown>;
    const item = parsedLine.item as Record<string, unknown> | undefined;
    if (provider === "codex") return parsedLine.type === "item.completed" && item?.type === "agent_message" && typeof item.text === "string" ? item.text : "";
    const message = parsedLine.message as Record<string, unknown> | undefined;
    if (provider === "claude" && parsedLine.type === "assistant") return extractClaudeText(message?.content);
    if (provider === "claude" && parsedLine.type === "result" && parsedLine.is_error === true) return typeof parsedLine.result === "string" ? parsedLine.result : "Provider error";
    return "";
  } catch { return ""; }
}

// extractClaudeText joins only visible text blocks from a Claude message.
function extractClaudeText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map((contentBlock) => {
    if (!contentBlock || typeof contentBlock !== "object") return "";
    const typedBlock = contentBlock as Record<string, unknown>;
    return typedBlock.type === "text" && typeof typedBlock.text === "string" ? typedBlock.text : "";
  }).filter(Boolean).join("\n");
}

// HistoryView renders Git's real all-ref topological graph and commit metadata.
function HistoryView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  useEffect(() => { Promise.all([api.commits(repo.path), api.branches(repo.path)]).then(([commitList, branchList]) => { setCommits(commitList); setBranches(branchList); }).catch((reason: unknown) => onError(String(reason))); }, [repo.path, onError]);
  return <section className="history git-history"><div className="section-title"><div><span className="eyebrow">All refs · topological order</span><h2>Repository graph</h2></div><span className="count">{commits.length} commits</span></div><div className="branch-strip">{branches.map((branch) => <span className={branch === repo.branch ? "branch-pill branch-pill--active" : "branch-pill"} key={branch}>{branch === repo.branch ? "● " : ""}{branch}</span>)}</div><div className="git-graph">{commits.map((commit) => <article className="graph-commit" key={commit.hash}><pre>{[...(commit.connectors ?? []), commit.graph || "*"].join("\n")}</pre><code>{commit.short}</code><div className="graph-commit__body"><div><strong>{commit.subject || "No commit message"}</strong>{commit.parents.length > 1 ? <span className="merge-chip">merge · {commit.parents.length} parents</span> : null}</div><small>{commit.author} · {formatDate(commit.date)}</small>{commit.refs ? <div className="ref-list">{commit.refs.split(", ").map((reference) => <span key={reference}>{reference}</span>)}</div> : null}</div></article>)}</div></section>;
}

// StatsView explains the size, activity, and language makeup of a repository.
function StatsView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [statistics, setStatistics] = useState<RepositoryStats | null>(null);
  const [recentCommits, setRecentCommits] = useState<Commit[]>([]);
  useEffect(() => { Promise.all([api.repositoryStats(repo.path), api.commits(repo.path)]).then(([repositoryStatistics, commitList]) => { setStatistics(repositoryStatistics); setRecentCommits(commitList.slice(0, 12)); }).catch((reason: unknown) => onError(String(reason))); }, [repo.path, onError]);
  if (!statistics) return <section className="stats-view"><div className="reader__loading">measuring repository…</div></section>;
  const facts = [{ label: "Commits", value: statistics.commits.toLocaleString() }, { label: "Branches", value: statistics.branches.toLocaleString() }, { label: "Contributors", value: statistics.contributors.toLocaleString() }, { label: "Tracked files", value: statistics.files.toLocaleString() }, { label: "Source lines", value: statistics.lines.toLocaleString() }, { label: "Tracked size", value: formatBytes(statistics.bytes) }];
  return <section className="stats-view"><header><div><span className="eyebrow">Repository intelligence</span><h2>{repo.fullName}</h2><p>{repo.path}</p></div><span className="stats-language">{repo.language}</span></header><div className="stats-facts">{facts.map((fact) => <article key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></article>)}</div><div className="stats-detail"><article><span className="eyebrow">Language footprint</span><h3>Tracked composition</h3><div className="language-bars">{statistics.languages.slice(0, 10).map((language) => <div key={language.name}><header><strong>{language.name}</strong><span>{language.percent.toFixed(1)}% · {language.files} files</span></header><div><i style={{ width: `${Math.max(language.percent, 1)}%` }}/></div></div>)}</div></article><article className="activity-card"><span className="eyebrow">Activity range</span><h3>Repository lifetime</h3><dl><div><dt>First commit</dt><dd>{formatDate(statistics.firstCommit)}</dd></div><div><dt>Latest commit</dt><dd>{formatDate(statistics.lastCommit)}</dd></div><div><dt>Current branch</dt><dd>{repo.branch || "Detached HEAD"}</dd></div><div><dt>Remote</dt><dd>{repo.githubUrl || "Local only"}</dd></div></dl></article><article className="contributors-card"><span className="eyebrow">Authorship</span><h3>Who committed</h3><div className="contributor-list">{statistics.contributorsByIdentity.slice(0, 10).map((contributor) => <div key={`${contributor.name}-${contributor.email}`}><header><strong>{contributor.name}</strong><span>{contributor.commits} commits · {contributor.percent.toFixed(1)}%</span></header><small>{contributor.email || "No public email"}</small><i><b style={{ width: `${Math.max(contributor.percent, 1)}%` }}/></i></div>)}</div></article><article className="recent-commits-card"><span className="eyebrow">Recent work</span><h3>Who changed what</h3><div className="recent-commits">{recentCommits.map((commit) => <div key={commit.hash}><code>{commit.short}</code><p><strong>{commit.subject}</strong><small>{commit.author} · {formatDate(commit.date)}</small></p></div>)}</div></article></div></section>;
}

// ReviewsView keeps GitHub pull requests close to the repository reading context.
function ReviewsView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.pullRequests(repo.path).then(setPullRequests).catch((reason: unknown) => onError(String(reason))).finally(() => setLoading(false)); }, [repo.path, onError]);
  return <section className="reviews-view"><header><div><span className="eyebrow">GitHub collaboration</span><h2>Pull requests</h2></div><span className="count">{pullRequests.length}</span></header>{loading ? <div className="reader__loading">gathering reviews…</div> : <div className="review-list">{pullRequests.map((pullRequest) => <button key={pullRequest.number} onClick={() => api.openURL(pullRequest.url)}><span className={pullRequest.state === "OPEN" ? "review-state review-state--open" : "review-state"}>{pullRequest.draft ? "draft" : pullRequest.state.toLowerCase()}</span><div><strong>#{pullRequest.number} {pullRequest.title}</strong><small>{pullRequest.author} · {pullRequest.headBranch} → {pullRequest.baseBranch} · {formatDate(pullRequest.updated)}</small></div><span>↗</span></button>)}{!pullRequests.length ? <div className="empty"><h3>No pull requests</h3><p>This repository has no GitHub review items to show.</p></div> : null}</div>}</section>;
}

// SecurityView runs allowlisted scanners and streams their output live.
function SecurityView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
  const [scanners, setScanners] = useState<ScannerInfo[]>([]);
  const [selectedScanner, setSelectedScanner] = useState("");
  const [jobID, setJobID] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [reportPath, setReportPath] = useState("");
  useEffect(() => { api.scanners().then((scannerList) => { setScanners(scannerList); setSelectedScanner(scannerList.find((scanner) => scanner.available)?.name ?? ""); }); }, []);
  useEffect(() => {
    const unsubscribe = EventsOn("scan:event", (event: ScanEvent) => { if (jobID && event.jobId !== jobID) return; if (event.kind === "output") setOutput((currentOutput) => [...currentOutput, event.text]); if (["finished", "findings", "error"].includes(event.kind)) { setRunning(false); setReportPath(event.reportPath); if (event.text) setOutput((currentOutput) => [...currentOutput, event.text]); } });
    return unsubscribe;
  }, [jobID]);
  // startScan clears the previous report and launches one selected scanner.
  function startScan() { if (!selectedScanner) return; setOutput([]); setReportPath(""); setRunning(true); api.startScan(repo.path, selectedScanner).then(setJobID).catch((reason: unknown) => { setRunning(false); onError(String(reason)); }); }
  // cancelScan stops the active scanner while preserving all output received.
  function cancelScan() { if (jobID) api.cancelScan(jobID).catch((reason: unknown) => onError(String(reason))); }
  return <section className="security-view"><aside><span className="eyebrow">Local checkout</span><h2>Security harvest</h2><p>Run installed scanners against {repo.name}. Output is streamed and archived locally.</p><div className="scanner-list">{scanners.map((scanner) => <div className="scanner-row" key={scanner.name}><button disabled={!scanner.available || running} className={selectedScanner === scanner.name ? "scanner scanner--active" : "scanner"} onClick={() => setSelectedScanner(scanner.name)}><span className={scanner.available ? "tool__light tool__light--ready" : "tool__light"}/><strong>{scanner.name}</strong><small>{scanner.available ? "ready" : scanner.install}</small></button>{scanner.available ? null : <InstallPill commands={scanner.commands}/>}</div>)}</div>{running ? <button className="ghost" onClick={cancelScan}>Cancel scan</button> : <button className="primary" disabled={!selectedScanner} onClick={startScan}>Run {selectedScanner || "scanner"}</button>}</aside><article><header><div><span className="eyebrow">{selectedScanner || "Scanner"}</span><h2>{running ? "Scanning…" : "Report"}</h2></div>{reportPath ? <code>{reportPath}</code> : null}</header><pre>{output.length ? output.join("\n") : "Select an installed scanner to begin."}</pre></article></section>;
}

const analysisPresets = [
  { name: "Security review", prompt: "Perform a security review of this repository. Look for injection risks, secrets handling problems, authentication weaknesses, and dependency red flags. Report findings by severity with exact file references." },
  { name: "Architecture summary", prompt: "Summarize this repository's architecture: what it does, the main modules and their responsibilities, data flow, and integrations. Keep it practical and cite exact files." },
  { name: "Code quality review", prompt: "Review this repository's code quality: error handling, test coverage, dead code, and duplication. End with the three highest-impact improvements and cite exact files." },
  { name: "Custom analysis", prompt: "" },
];

// AnalysisView runs deliberate repository-wide reviews outside conversational chat.
function AnalysisView({ repo, tools, onError }: { repo: Repo; tools: Bootstrap["tools"]; onError: (message: string) => void }) {
  const [selectedPreset, setSelectedPreset] = useState(analysisPresets[0].name);
  const [provider, setProvider] = useState("codex");
  const [customPrompt, setCustomPrompt] = useState("");
  const [jobID, setJobID] = useState("");
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState("");
  const selectedAnalysis = analysisPresets.find((preset) => preset.name === selectedPreset) ?? analysisPresets[0];
  const providerTool = tools.find((tool) => tool.name === provider);

  useEffect(() => {
    const unsubscribe = EventsOn("analysis:event", (event: AnalysisEvent) => {
      if (!jobID || event.jobId !== jobID) return;
      if (event.kind === "output") {
        const readableText = readableProviderLine(event.text, event.provider);
        if (readableText) setResult((currentResult) => `${currentResult}${currentResult ? "\n\n" : ""}${readableText}`);
      }
      if (event.kind === "finished" || event.kind === "error") {
        setRunning(false);
        if (event.text) setResult((currentResult) => `${currentResult}${currentResult ? "\n\n" : ""}${event.text}`);
      }
    });
    return unsubscribe;
  }, [jobID]);

  useEffect(() => {
    if (!running) return;
    const elapsedTimer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(elapsedTimer);
  }, [running, startedAt]);

  // runAnalysis starts a fresh read-only review and preserves any partial response.
  function runAnalysis() {
    const prompt = (selectedAnalysis.prompt || customPrompt).trim();
    if (!prompt || running) return;
    setResult("");
    setElapsedSeconds(0);
    setStartedAt(Date.now());
    setRunning(true);
    api.startAnalysis(repo.path, provider, `${prompt}\n\nRepository: ${repo.fullName}\nBranch: ${repo.branch}. Read the repository before reaching conclusions.`).then(setJobID).catch((reason: unknown) => { setRunning(false); onError(String(reason)); });
  }

  // cancelAnalysis stops the provider while keeping everything already streamed.
  function cancelAnalysis() {
    if (jobID) api.cancelAnalysis(jobID).catch((reason: unknown) => onError(String(reason)));
  }

  return <section className="analysis-view"><aside><span className="eyebrow">Repository review</span><h2>Analysis</h2><p>Run a focused, read-only investigation across {repo.name}. This is separate from screen-aware chat and designed for findings you keep.</p><label><span>Provider</span><select value={provider} onChange={(event) => setProvider(event.target.value)} disabled={running}><option value="codex">Codex</option><option value="claude">Claude</option></select></label>{providerTool && !providerTool.available ? <div className="provider-install"><span>{providerTool.install} is required</span><InstallPill commands={providerTool.commands}/></div> : null}<div className="analysis-presets">{analysisPresets.map((preset) => <button className={preset.name === selectedPreset ? "analysis-preset analysis-preset--active" : "analysis-preset"} key={preset.name} disabled={running} onClick={() => setSelectedPreset(preset.name)}><BrainCircuit size={15}/><span><strong>{preset.name}</strong><small>{preset.prompt ? preset.prompt.split(". ")[0] : "Ask Reaper to investigate anything"}</small></span></button>)}</div>{selectedAnalysis.prompt ? null : <textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} placeholder="What should Reaper investigate?" rows={5}/>}<div className="analysis-actions">{running ? <button className="ghost" onClick={cancelAnalysis}>Cancel · {elapsedSeconds}s</button> : <button className="primary" disabled={!providerTool?.available || (!selectedAnalysis.prompt && !customPrompt.trim())} onClick={runAnalysis}>Run analysis</button>}</div></aside><article><header><div><span className="eyebrow">{running ? `Live · ${elapsedSeconds}s` : result ? "Latest result" : "Ready"}</span><h2>{selectedPreset}</h2></div><span className={running ? "analysis-state analysis-state--running" : "analysis-state"}>{running ? "reading repository" : provider}</span></header><pre>{result || "Choose a review preset and run it. Provider prose appears here; JSON event noise and internal tool calls are filtered out."}</pre></article></section>;
}

// ToolsView explains which optional host integrations are ready to use.
function ToolsView({ tools }: { tools: Bootstrap["tools"] }) {
  return <section className="tools"><div className="section-title"><div><span className="eyebrow">Host integration</span><h2>Toolchain</h2></div></div><div className="tool-grid">{tools.map((tool) => <article className="tool panel" key={tool.name}><span className={tool.available ? "tool__light tool__light--ready" : "tool__light"}/><div><h3>{tool.name}</h3><p>{tool.available ? tool.version || "available" : tool.install}</p></div>{tool.available ? <span className="chip chip--ready">ready</span> : <InstallPill commands={tool.commands}/>}</article>)}</div></section>;
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

// InstallPill reveals package-manager commands and copies one without executing it.
function InstallPill({ commands }: { commands: InstallCommand[] }) {
  const [copiedManager, setCopiedManager] = useState("");
  // copyCommand copies an explicit install command and never runs it automatically.
  function copyCommand(installCommand: InstallCommand) {
    navigator.clipboard.writeText(installCommand.command).then(() => { setCopiedManager(installCommand.manager); window.setTimeout(() => setCopiedManager(""), 1400); });
  }
  return <details className="install-pill"><summary>Install <span>⌄</span></summary><div className="install-menu">{commands.map((installCommand) => <button key={installCommand.manager} onClick={() => copyCommand(installCommand)}><strong>{installCommand.manager}</strong><code>{installCommand.command}</code><span>{copiedManager === installCommand.manager ? "Copied" : "Copy"}</span></button>)}</div></details>;
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

  return <section className="settings-view"><header><span className="eyebrow">Desktop foundation</span><h2>Make Reaper yours</h2><p>Appearance changes preview live. Save writes the same portable JSON configuration used at startup.</p></header><div className="settings-grid"><article className="settings-card"><div className="settings-card__head"><span>01</span><div><h3>Environment</h3><p>Connect Reaper to your local development setup.</p></div></div><label><span>Repository workspace</span><input value={draft.workspace} onChange={(event) => setDraft({ ...draft, workspace: event.target.value })}/></label><label><span>Editor command</span><input value={draft.editor} onChange={(event) => setDraft({ ...draft, editor: event.target.value })}/></label></article><article className="settings-card settings-card--appearance"><div className="settings-card__head"><span>02</span><div><h3>Atmosphere</h3><p>Tune the cockpit rather than accepting one fixed skin.</p></div></div><label><span>Colour system</span><select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as ThemeName })}>{themes.map((themeOption) => <option key={themeOption.name} value={themeOption.name}>{themeOption.label}</option>)}</select></label><label className="range-field"><span>Underglow <output>{draft.glow.toFixed(1)}×</output></span><input type="range" min="0.5" max="2.5" step="0.1" value={draft.glow} onChange={(event) => setDraft({ ...draft, glow: Number(event.target.value) })}/></label><label className="range-field"><span>Corner softness <output>{draft.radius}px</output></span><input type="range" min="10" max="28" step="1" value={draft.radius} onChange={(event) => setDraft({ ...draft, radius: Number(event.target.value) })}/></label><label className="range-field"><span>Glass depth <output>{Math.round(draft.glass * 100)}%</output></span><input type="range" min="0.55" max="0.96" step="0.01" value={draft.glass} onChange={(event) => setDraft({ ...draft, glass: Number(event.target.value) })}/></label></article></div><footer><div><span className="eyebrow">Configuration file</span><code>{configPath || "resolving…"}</code></div><button className="primary" disabled={saving} onClick={saveSettings}>{saving ? "Saving…" : "Save configuration"}</button></footer></section>;
}

// EmptyWorkspace explains how to point Abduction at local checkouts.
function EmptyWorkspace({ workspace }: { workspace: string }) {
  return <section className="empty panel"><div className="reaper-mark">A</div><h2>No repositories in range</h2><p>Abduction looks for Git checkouts directly inside:</p><code>{workspace}</code><p>Set <code>REAPER_WORKSPACE_PATH</code> before launching to use another folder.</p></section>;
}

// formatBytes turns raw sizes into compact reader metadata.
function formatBytes(size: number): string {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// formatDate converts Git timestamps into a concise local date.
function formatDate(timestamp: string): string {
  const parsedDate = new Date(timestamp);
  return Number.isNaN(parsedDate.valueOf()) ? timestamp : parsedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
