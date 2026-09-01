import { useEffect, useState } from "react";
import { BrainCircuit } from "lucide-react";
import { api } from "../../api";
import type { AnalysisEvent, Bootstrap, InstallCommand, Repo, ScanEvent, ScannerInfo } from "../../types";
import { ClipboardSetText, EventsOn } from "../../../wailsjs/runtime/runtime";
import { InstallPill } from "../../components/InstallPill";
import { readableProviderLine } from "../code/CodeView";

// SecurityView runs allowlisted scanners and streams their output live.
export function SecurityView({ repo, onError }: { repo: Repo; onError: (message: string) => void }) {
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
export function AnalysisView({ repo, tools, onError }: { repo: Repo; tools: Bootstrap["tools"]; onError: (message: string) => void }) {
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
      if (jobID && event.jobId !== jobID) return;
      if (!jobID && event.jobId) setJobID(event.jobId);
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

// ToolsView centralizes every host dependency and its platform install commands.
export function ToolsView({ tools }: { tools: Bootstrap["tools"] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTools = normalizedQuery ? tools.filter((tool) => `${tool.name} ${tool.install} ${tool.category} ${(tool.languages ?? []).join(" ")}`.toLowerCase().includes(normalizedQuery)) : tools;
  const categories = ["Core integration", "AI providers", "Security scanners", "Language linters"];
  return <section className="tools dependency-view"><header className="dependency-hero"><div><span className="eyebrow">Host tooling</span><h2>Dependencies</h2><p>Every optional integration and install command lives here. Abduction never runs these commands for you—click one to copy it.</p></div><div><strong>{tools.filter((tool) => tool.available).length}/{tools.length}</strong><span>ready</span></div></header><input className="dependency-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a tool or language…" aria-label="Search dependencies"/>{categories.map((category) => { const categoryTools = visibleTools.filter((tool) => tool.category === category); return categoryTools.length ? <section className="dependency-group" key={category}><header><h3>{category}</h3><span>{categoryTools.filter((tool) => tool.available).length}/{categoryTools.length} installed</span></header><div>{categoryTools.map((tool) => <DependencyCard key={tool.name} tool={tool}/>)}</div></section> : null; })}</section>;
}

function DependencyCard({ tool }: { tool: Bootstrap["tools"][number] }) {
  const [copiedManager, setCopiedManager] = useState("");
  function copyCommand(command: InstallCommand) {
    ClipboardSetText(command.command).then(() => { setCopiedManager(command.manager); window.setTimeout(() => setCopiedManager(""), 1400); });
  }
  const languages = tool.languages ?? [];
  return <article className={tool.available ? "dependency-card dependency-card--ready" : "dependency-card"}><header><span className={tool.available ? "tool__light tool__light--ready" : "tool__light"}/><div><h4>{tool.name}</h4><p>{tool.available ? tool.version || "Installed and ready" : tool.install}</p>{languages.length ? <small>{languages.join(" · ")}</small> : null}</div><b>{tool.available ? "READY" : "OPTIONAL"}</b></header><div className="dependency-commands">{tool.commands.map((command) => <button key={command.manager} onClick={() => copyCommand(command)}><span>{command.manager}</span><code>{command.command}</code><b>{copiedManager === command.manager ? "Copied" : "Copy"}</b></button>)}</div></article>;
}

