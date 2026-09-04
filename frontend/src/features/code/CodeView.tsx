import { useEffect, useRef, useState } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { api } from "../../api";
import type { AnalysisEvent, Document, InstallCommand, LinterInfo, LintReport, Repo, SearchResult, ThemeName, TreeEntry } from "../../types";
import { ClipboardSetText, EventsOn } from "../../../wailsjs/runtime/runtime";
import { markTextMatches, regexError } from "../../search";
import { InstallPill } from "../../components/InstallPill";

// CodeView combines a lazy file browser with the rich document reader.
export function CodeView({ repo, theme, onError }: { repo: Repo; theme: ThemeName; onError: (message: string) => void }) {
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [childrenByPath, setChildrenByPath] = useState<Record<string, TreeEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"files" | "content">("files");
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [findQuery, setFindQuery] = useState("");
  const [findRegex, setFindRegex] = useState(false);
  const [findLine, setFindLine] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [treeVisible, setTreeVisible] = useState(true);
  const [treePaneWidthIndex, setTreePaneWidthIndex] = useState(1);
  const treePaneWidths = [260, 320, 380];
  const treePaneWidth = treePaneWidths[treePaneWidthIndex] ?? treePaneWidths[0];
  const treeRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prepareRepository = repo.path ? Promise.resolve() : api.preloadRemoteRepository(repo.fullName, repo.branch).then(() => undefined);
    prepareRepository.then(() => Promise.all([repo.path ? api.listDirectory(repo.path, "") : api.listRemoteDirectory(repo.fullName, "", repo.branch), repo.path ? api.readOverview(repo.path, theme) : api.readRemoteOverview(repo.fullName, repo.branch, theme)])).then(([rootEntries, overview]) => { setEntries(rootEntries); setDocument(overview); }).catch((reason: unknown) => onError(String(reason))).finally(() => setLoading(false));
  }, [repo.path, theme, onError]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const minimumLength = searchRegex ? 1 : 2;
    if (trimmedQuery.length < minimumLength) { setSearchResults([]); setSearchError(""); return; }
    if (searchRegex) {
      const validationError = regexError(trimmedQuery);
      if (validationError) { setSearchResults([]); setSearchError(validationError); return; }
    }
    let cancelled = false;
    setSearchError("");
    if (!repo.path) { setSearchResults([]); setSearchError("Remote search is coming from GitHub; clone this repository for full content search."); return; }
    const searchRequest = searchMode === "files" ? api.searchRepositoryFilesPattern : api.searchRepositoryPattern;
    const searchTimer = window.setTimeout(() => searchRequest(repo.path, trimmedQuery, searchRegex).then((results) => { if (!cancelled) setSearchResults(results); }).catch((reason: unknown) => { if (!cancelled) { setSearchResults([]); setSearchError(String(reason)); } }), 180);
    return () => { cancelled = true; window.clearTimeout(searchTimer); };
  }, [repo.path, searchQuery, searchMode, searchRegex]);

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
      if (event.key.toLowerCase() === "t") { event.preventDefault(); setTreeVisible((visible) => !visible); }
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
      if (!childrenByPath[entry.path]) (repo.path ? api.listDirectory(repo.path, entry.path) : api.listRemoteDirectory(repo.fullName, entry.path, repo.branch)).then((children) => setChildrenByPath((currentChildren) => ({ ...currentChildren, [entry.path]: children }))).catch((reason: unknown) => onError(String(reason)));
      return;
    }
    setLoading(true);
    (repo.path ? api.readFile(repo.path, entry.path, theme) : api.readRemoteFile(repo.fullName, entry.path, repo.branch, theme)).then((nextDocument) => { setDocument(nextDocument); setLoading(false); }).catch((reason: unknown) => { setLoading(false); onError(String(reason)); });
  }

  // openSearchResult renders a matched file while retaining the search results.
  function openSearchResult(searchResult: SearchResult) {
    setLoading(true);
    setFindQuery(searchResult.kind === "content" ? searchQuery.trim() : "");
    setFindRegex(searchResult.kind === "content" && searchRegex);
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

  const layoutClass = ["code-layout", chatOpen ? "code-layout--chat" : "", focusMode ? "code-layout--focus" : "", !treeVisible ? "code-layout--tree-hidden" : ""].filter(Boolean).join(" ");
  const layoutStyle = { ["--tree-pane-width" as string]: `${treePaneWidth}px` } as React.CSSProperties;
  const searchActive = searchQuery.trim().length >= (searchRegex ? 1 : 2);
  return <section className={layoutClass} style={layoutStyle}>
    <aside ref={treeRef} className="tree" onKeyDown={handleTreeNavigation}>
      <div className="tree-search-panel">
        <div className="tree__title"><span>Explorer</span><div><button onClick={() => setTreePaneWidthIndex((currentIndex) => (currentIndex + 1) % treePaneWidths.length)} title="Resize tree pane" aria-label="Resize tree pane">↔</button><button onClick={() => setExpandedPaths(new Set())} disabled={!expandedPaths.size} title="Collapse all folders" aria-label="Collapse all folders">−</button></div></div>
        <div className="search-modes">
          <button className={searchMode === "files" ? "search-mode search-mode--active" : "search-mode"} onClick={() => setSearchMode("files")}>Filenames</button>
          <button className={searchMode === "content" ? "search-mode search-mode--active" : "search-mode"} onClick={() => setSearchMode("content")}>In files</button>
          <button className={searchRegex ? "search-mode search-mode--active search-regex" : "search-mode search-regex"} onClick={() => setSearchRegex((enabled) => !enabled)} aria-pressed={searchRegex} title="Use regular expression">.*</button>
        </div>
        <input ref={searchRef} className={searchError ? "tree__search tree__search--error" : "tree__search"} aria-invalid={Boolean(searchError)} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setSearchQuery(""); event.currentTarget.blur(); } }} placeholder={searchMode === "files" ? "Find a tracked filename…" : "Search inside tracked files…"} aria-label="Search repository"/>
        {searchError ? <p className="search-error" role="alert">{searchError}</p> : null}
      </div>
      <div className="tree-scroll-region">
        {searchActive ? <div className="search-results">{searchResults.map((searchResult) => <button data-tree-item key={`${searchResult.path}:${searchResult.line}`} onClick={() => openSearchResult(searchResult)}><strong>{searchResult.path}</strong><small>{searchResult.kind === "content" ? `line ${searchResult.line}` : "file"}</small><span>{searchResult.kind === "content" ? searchResult.preview : searchResult.preview === "." ? "Repository root" : searchResult.preview}</span></button>)}{!searchResults.length && !searchError ? <p>No tracked matches.</p> : null}</div> : <><div className="tree__root"><FolderOpen size={15}/><strong>{repo.name}</strong><kbd>/</kbd></div><div className="tree__list" role="tree" aria-label={`${repo.name} files`}><TreeNodes entries={entries} depth={0} activePath={document?.path ?? ""} expandedPaths={expandedPaths} childrenByPath={childrenByPath} onOpen={openEntry}/></div></>}
      </div>
    </aside>
    <article className="reader">{loading ? <div className="reader__loading">rendering…</div> : document ? <DocumentView document={document} repo={repo} findQuery={findQuery} findRegex={findRegex} findLine={findLine} onChat={() => setChatOpen(true)} focusMode={focusMode} treeVisible={treeVisible} onFocus={() => setFocusMode(!focusMode)} onTree={() => setTreeVisible(!treeVisible)} /> : null}</article>
    {chatOpen && document ? <ChatDrawer repo={repo} document={document} onClose={() => setChatOpen(false)} onError={onError}/> : null}
  </section>;
}

const fileLanguageIcons: Record<string, [string, string]> = {
  ts:["TS","blue"],tsx:["TX","blue"],js:["JS","yellow"],jsx:["JX","yellow"],go:["GO","cyan"],py:["PY","green"],rs:["RS","orange"],rb:["RB","red"],
  java:["JV","orange"],kt:["KT","violet"],swift:["SW","orange"],cs:["C#","violet"],c:["C","blue"],h:["H","violet"],cpp:["C+","blue"],hpp:["H+","violet"],
  sh:[">_","green"],bash:[">_","green"],zsh:[">_","green"],fish:[">_","green"],tf:["TF","violet"],hcl:["HC","violet"],yaml:["Y","red"],yml:["Y","red"],
  json:["{}","yellow"],jsonc:["{}","yellow"],toml:["TM","orange"],xml:["XM","orange"],html:["HT","orange"],css:["#","blue"],scss:["S","pink"],vue:["V","green"],svelte:["SV","orange"],
  md:["M↓","blue"],mdx:["MX","blue"],sql:["DB","cyan"],graphql:["GQ","pink"],lua:["LU","blue"],php:["P","violet"],dart:["DT","cyan"],ex:["EX","violet"],exs:["EX","violet"],
};

function FileLanguageIcon({ name }: { name: string }) {
  const normalizedName = name.toLowerCase();
  const special: [string, string] | undefined = normalizedName === "dockerfile" ? ["DK","blue"] : normalizedName === "makefile" ? ["MK","orange"] : normalizedName.startsWith(".env") ? ["E","yellow"] : undefined;
  const extension = normalizedName.includes(".") ? normalizedName.split(".").pop() ?? "" : "";
  const icon = special ?? fileLanguageIcons[extension];
  return icon ? <span className={"tree-language-icon tree-language-icon--" + icon[1]} aria-hidden>{icon[0]}</span> : <File size={14}/>;
}

// TreeNodes renders a lazy recursive hierarchy while preserving folder context.
function TreeNodes({ entries, depth, activePath, expandedPaths, childrenByPath, onOpen }: { entries: TreeEntry[]; depth: number; activePath: string; expandedPaths: Set<string>; childrenByPath: Record<string, TreeEntry[]>; onOpen: (entry: TreeEntry) => void }) {
  return <>{entries.map((entry) => { const expanded = expandedPaths.has(entry.path); const active = entry.kind === "file" && entry.path === activePath; const entryClass = ["tree__entry", entry.kind === "directory" ? "tree__entry--directory" : "tree__entry--file", expanded ? "tree__entry--expanded" : "", active ? "tree__entry--active" : ""].filter(Boolean).join(" "); return <div className="tree-node" key={entry.path} role="treeitem" aria-level={depth + 1} aria-selected={active || undefined} aria-expanded={entry.kind === "directory" ? expanded : undefined}><button data-tree-item data-kind={entry.kind} data-expanded={expanded} className={entryClass} onClick={() => onOpen(entry)}><ChevronRight className="tree-caret" size={13}/><span className="tree-kind-icon">{entry.kind === "directory" ? (expanded ? <FolderOpen size={15}/> : <Folder size={15}/>) : <FileLanguageIcon name={entry.name}/>}</span><span className="tree-entry-name">{entry.name}</span>{entry.kind === "file" ? <small>{formatBytes(entry.size)}</small> : null}</button>{entry.kind === "directory" && expanded ? <div className="tree-children" role="group"><TreeNodes entries={childrenByPath[entry.path] ?? []} depth={depth + 1} activePath={activePath} expandedPaths={expandedPaths} childrenByPath={childrenByPath} onOpen={onOpen}/></div> : null}</div>; })}</>;
}

// DocumentView displays trusted HTML and navigates highlighted search matches.
function DocumentView({ document, repo, findQuery, findRegex, findLine, onChat, focusMode, treeVisible, onFocus, onTree }: { document: Document; repo: Repo; findQuery: string; findRegex: boolean; findLine: number; onChat: () => void; focusMode: boolean; treeVisible: boolean; onFocus: () => void; onTree: () => void }) {
  const documentRoot = useRef<HTMLDivElement>(null);
  const [matches, setMatches] = useState<HTMLElement[]>([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const [lintOpen, setLintOpen] = useState(false);
  const [lintStatus, setLintStatus] = useState("");
  const lintAvailable = Boolean(repo.path && !document.binary && document.path);

  useEffect(() => {
    const rootElement = documentRoot.current;
    if (!rootElement || !findQuery) { setMatches([]); return; }
    const highlightedMatches = markTextMatches(rootElement, findQuery, findRegex);
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
  }, [document.html, findQuery, findRegex, findLine]);

  // moveMatch cycles through highlighted occurrences in either direction.
  function moveMatch(direction: number) {
    if (!matches.length) return;
    const nextMatch = (activeMatch + direction + matches.length) % matches.length;
    setActiveMatch(nextMatch);
    activateSearchMatch(matches, nextMatch);
  }

  async function copyMarkdownCode(event: React.MouseEvent<HTMLDivElement>) {
    const copyButton = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-markdown-copy]");
    if (!copyButton) return;
    const codeText = copyButton.parentElement?.querySelector("pre code")?.textContent ?? "";
    if (!codeText) return;
    try {
      const copied = await ClipboardSetText(codeText);
      if (!copied) throw new Error("Native clipboard rejected the copy request");
    } catch {
      await navigator.clipboard.writeText(codeText);
    }
    copyButton.textContent = "Copied";
    copyButton.classList.add("markdown-copy--done");
    window.setTimeout(() => { copyButton.textContent = "Copy"; copyButton.classList.remove("markdown-copy--done"); }, 1400);
  }

  return <><header className="reader__head"><div><span className="eyebrow">{document.language || "preview"}</span><h2>{document.name}</h2></div><div className="reader__meta">{findQuery ? <div className="find-navigation"><strong>{matches.length ? `${activeMatch + 1} / ${matches.length}` : "No matches"}</strong><button onClick={() => moveMatch(-1)} disabled={!matches.length} aria-label="Previous match">↑</button><button onClick={() => moveMatch(1)} disabled={!matches.length} aria-label="Next match">↓</button></div> : null}<span>{document.lines ? `${document.lines} lines` : "preview unavailable"}</span><span>{formatBytes(document.size)}</span>{focusMode ? <button className="ghost" onClick={onTree}>{treeVisible ? "Hide tree" : "Show tree"}</button> : null}{lintAvailable ? <button className={lintOpen ? "ghost lint-button lint-button--active" : "ghost lint-button"} onClick={() => setLintOpen(!lintOpen)} aria-expanded={lintOpen} title="Run linters against this file">◇ Lint{lintStatus ? <b>{lintStatus}</b> : null}</button> : null}<button className="ghost chat-button" onClick={onChat}>✣ Ask AI</button><button className="ghost" onClick={onFocus}>{focusMode ? "Exit focus" : "Focus"}</button>{repo.path ? <button className="ghost" onClick={() => api.openInEditor(repo.path, document.path)}>Edit ↗</button> : null}</div></header>{lintAvailable ? <LintPanel key={document.path} repo={repo} document={document} open={lintOpen} onStatus={setLintStatus} onJump={(line) => documentRoot.current?.querySelector(`#line-${line}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}/> : null}{document.binary ? <div className="empty"><h3>Preview unavailable</h3><p>This file is binary or larger than the safe 16 MB in-app preview limit. Open it in your configured editor to inspect it.</p></div> : <div ref={documentRoot} onClick={document.markdown ? copyMarkdownCode : undefined} className={document.markdown ? "document markdown" : "document code"} dangerouslySetInnerHTML={{ __html: document.html }}/>}</>;
}

// LintPanel selects installed linters for the active file and lists their normalised diagnostics.
function LintPanel({ repo, document, open, onStatus, onJump }: { repo: Repo; document: Document; open: boolean; onStatus: (status: string) => void; onJump: (line: number) => void }) {
  const [linters, setLinters] = useState<LinterInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [reports, setReports] = useState<LintReport[]>([]);
  const [running, setRunning] = useState(false);
  const [lintError, setLintError] = useState("");
  const preferenceKey = `abduction-linters:${document.language.toLowerCase()}`;

  useEffect(() => {
    api.linters(document.language).then((availableLinters) => {
      setLinters(availableLinters);
      const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? "[]") as string[];
      setSelected(saved.filter((name) => availableLinters.some((linter) => linter.name === name)));
    }).catch((reason: unknown) => setLintError(String(reason)));
  }, [document.language, preferenceKey]);

  function toggleLinter(name: string) {
    const nextSelection = selected.includes(name) ? selected.filter((selectedName) => selectedName !== name) : [...selected, name];
    setSelected(nextSelection);
    localStorage.setItem(preferenceKey, JSON.stringify(nextSelection));
  }

  function runLint() {
    if (!selected.length || running) return;
    setRunning(true); setReports([]); setLintError("");
    api.runLinters(repo.path, document.path, document.language, selected).then(setReports).catch((reason: unknown) => setLintError(String(reason))).finally(() => setRunning(false));
  }

  const diagnostics = reports.flatMap((report) => report.diagnostics);
  useEffect(() => { onStatus(running ? "checking…" : reports.length ? `${diagnostics.length} findings` : ""); }, [running, reports.length, diagnostics.length, onStatus]);
  return <section className="lint-panel" hidden={!open} aria-label="Lint"><div className="lint-picker"><header><div><span className="eyebrow">Tool selection</span><strong>{document.language} linters</strong></div><button className="primary" disabled={!selected.length || running} onClick={runLint}>{running ? "Linting…" : "Run selected"}</button></header>{linters.length ? linters.map((linter) => <div className="lint-option" key={linter.name}><label><input type="checkbox" checked={selected.includes(linter.name)} disabled={!linter.available || running} onChange={() => toggleLinter(linter.name)}/><span><strong>{linter.name}</strong><small>{linter.available ? "installed · ready" : linter.install}</small></span></label>{linter.available ? null : <InstallPill commands={linter.commands}/>}</div>) : <p>No registered linters for {document.language} yet.</p>}</div><div className="lint-results">{lintError ? <div className="notice">{lintError}</div> : null}{reports.map((report) => <article key={report.linter}><header><strong>{report.linter}</strong><span>{report.error || `${report.diagnostics.length} findings`}</span></header>{report.diagnostics.map((diagnostic, index) => <button key={`${diagnostic.path}:${diagnostic.line}:${index}`} onClick={() => onJump(diagnostic.line)}><b className={`lint-severity lint-severity--${diagnostic.severity}`}>{diagnostic.severity}</b><code>{diagnostic.path}:{diagnostic.line}{diagnostic.column ? `:${diagnostic.column}` : ""}</code><span>{diagnostic.message}</span></button>)}{!report.diagnostics.length && report.output ? <pre>{report.output}</pre> : null}{!report.diagnostics.length && !report.output && !report.error ? <p>Clean. No findings.</p> : null}</article>)}{!reports.length && !running ? <div className="lint-empty">Choose one or more installed tools, then run them against this file.</div> : null}</div></section>;
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
export function readableProviderLine(line: string, provider: string): string {
  try {
    const parsedLine = JSON.parse(line) as Record<string, unknown>;
    const item = parsedLine.item as Record<string, unknown> | undefined;
    if (provider === "codex") {
      if (["item.completed", "item.updated"].includes(String(parsedLine.type)) && item?.type === "agent_message") return extractProviderText(item.text ?? item.content);
      if (parsedLine.type === "response.output_text.delta") return typeof parsedLine.delta === "string" ? parsedLine.delta : "";
      if (parsedLine.type === "message") return extractProviderText(parsedLine.content);
      return "";
    }
    const message = parsedLine.message as Record<string, unknown> | undefined;
    if (provider === "claude" && parsedLine.type === "assistant") return extractClaudeText(message?.content);
    if (provider === "claude" && parsedLine.type === "result") return typeof parsedLine.result === "string" ? parsedLine.result : parsedLine.is_error === true ? "Provider error" : "";
    return "";
  } catch { return ""; }
}

function extractProviderText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => block && typeof block === "object" && typeof (block as Record<string, unknown>).text === "string" ? String((block as Record<string, unknown>).text) : "").filter(Boolean).join("\n");
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


function isEditingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
}

function formatBytes(size: number): string {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
