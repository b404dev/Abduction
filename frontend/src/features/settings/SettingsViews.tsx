import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { api } from "../../api";
import type { Bootstrap, ThemeName } from "../../types";
import { updateViewportUnits } from "../../viewport";
import { AlienGlyph } from "../shell/Shell";

export const themes: { name: ThemeName; label: string; palette: string[] }[] = [
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

export type LogEntry = { id: number; timestamp: string; level: "error"; message: string };

// ThemeSwitcher previews and applies complete visual bundles like a desktop theme picker.
export function ThemeSwitcher({ theme, onTheme }: { theme: ThemeName; onTheme: (theme: ThemeName) => void }) {
  // previewTheme applies a temporary bundle while the user explores the gallery.
  function previewTheme(previewName: ThemeName) { document.documentElement.dataset.theme = previewName; }
  // restoreTheme returns to the saved bundle when a preview loses focus.
  function restoreTheme() { document.documentElement.dataset.theme = theme; }
  return <section className="theme-switcher"><header><div><span className="eyebrow">Visual system</span><h2>Choose an atmosphere</h2><p>Each bundle changes the chrome, code canvas, syntax palette, glow, selection, surfaces, and shadows together.</p></div><span className="theme-count">{themes.length} themes</span></header><div className="theme-gallery">{themes.map((themeOption) => <button key={themeOption.name} className={theme === themeOption.name ? "theme-card theme-card--active" : "theme-card"} onMouseEnter={() => previewTheme(themeOption.name)} onMouseLeave={restoreTheme} onFocus={() => previewTheme(themeOption.name)} onBlur={restoreTheme} onClick={() => onTheme(themeOption.name)}><div className="theme-preview" style={{ background: themeOption.palette[0] }}><span className="theme-preview__rail" style={{ background: themeOption.palette[0], borderColor: themeOption.palette[1] }}/><span className="theme-preview__header" style={{ background: themeOption.palette[0], borderColor: themeOption.palette[1] }}/><span className="theme-preview__code"><i style={{ background: themeOption.palette[1] }}/><i style={{ background: themeOption.palette[2] }}/><i style={{ background: themeOption.palette[3] }}/><i style={{ background: themeOption.palette[1] }}/></span><span className="theme-preview__glow" style={{ background: themeOption.palette[2] }}/></div><footer><strong>{themeOption.label}</strong><span className="theme-swatches">{themeOption.palette.slice(1).map((paletteColour) => <i key={paletteColour} style={{ background: paletteColour }}/>)}</span>{theme === themeOption.name ? <small>Active</small> : null}</footer></button>)}</div></section>;
}

// LogsView presents retained application failures away from the working canvas.
export function LogsView({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const logText = logs.map((entry) => `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`).join("\n");
  // copyLogs copies the current diagnostic history for issue reports.
  function copyLogs() { if (logText) navigator.clipboard.writeText(logText); }
  return <section className="logs-view"><header><div><span className="eyebrow">Application diagnostics</span><h2>Event log</h2><p>Failures are retained here instead of being injected into your code workspace.</p></div><div><button className="ghost" disabled={!logs.length} onClick={copyLogs}>Copy log</button><button className="ghost" disabled={!logs.length} onClick={onClear}>Clear</button></div></header><div className="log-stream">{logs.length ? logs.map((entry) => <article className="log-entry" key={entry.id}><time>{new Date(entry.timestamp).toLocaleTimeString()}</time><span>{entry.level}</span><p>{entry.message}</p></article>) : <div className="log-empty"><ScrollText size={30}/><h3>All quiet</h3><p>No application errors have been recorded in this session.</p></div>}</div></section>;
}

// SettingsView edits the same JSON configuration loaded during application startup.
export function SettingsView({ bootstrap, onSaved, onError }: { bootstrap: Bootstrap; onSaved: (bootstrap: Bootstrap) => void; onError: (message: string) => void }) {
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
    document.documentElement.style.setProperty("--scale", String(draft.scale));
    updateViewportUnits();
  }, [draft]);

  // saveSettings validates preferences in Go and refreshes repository discovery.
  function saveSettings() {
    setSaving(true);
    api.updateConfig(draft).then(onSaved).catch((reason: unknown) => onError(String(reason))).finally(() => setSaving(false));
  }

  return <section className="settings-view"><header><span className="eyebrow">Desktop foundation</span><h2>Make Abduction yours</h2><p>Appearance changes preview live. Save writes the same portable JSON configuration used at startup.</p></header><div className="settings-grid"><article className="settings-card"><div className="settings-card__head"><span>01</span><div><h3>Environment</h3><p>Connect Abduction to your local development setup.</p></div></div><label><span>Repository workspace</span><input value={draft.workspace} onChange={(event) => setDraft({ ...draft, workspace: event.target.value })}/></label><label><span>Editor command</span><input value={draft.editor} onChange={(event) => setDraft({ ...draft, editor: event.target.value })}/></label></article><article className="settings-card settings-card--appearance"><div className="settings-card__head"><span>02</span><div><h3>Atmosphere</h3><p>Tune the cockpit rather than accepting one fixed skin.</p></div></div><label><span>Colour system</span><select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as ThemeName })}>{themes.map((themeOption) => <option key={themeOption.name} value={themeOption.name}>{themeOption.label}</option>)}</select></label><label className="range-field"><span>Underglow <output>{draft.glow.toFixed(1)}×</output></span><input type="range" min="0.5" max="2.5" step="0.1" value={draft.glow} onChange={(event) => setDraft({ ...draft, glow: Number(event.target.value) })}/></label><label className="range-field"><span>Corner softness <output>{draft.radius}px</output></span><input type="range" min="10" max="28" step="1" value={draft.radius} onChange={(event) => setDraft({ ...draft, radius: Number(event.target.value) })}/></label><label className="range-field"><span>Glass depth <output>{Math.round(draft.glass * 100)}%</output></span><input type="range" min="0.55" max="0.96" step="0.01" value={draft.glass} onChange={(event) => setDraft({ ...draft, glass: Number(event.target.value) })}/></label><label className="range-field"><span>Text &amp; UI scale <output>{Math.round(draft.scale * 100)}%</output></span><input type="range" min="0.85" max="1.35" step="0.05" value={draft.scale} onChange={(event) => setDraft({ ...draft, scale: Number(event.target.value) })}/></label></article></div><footer><div><span className="eyebrow">Configuration file · {bootstrap.platform} · v{bootstrap.version}</span><code>{configPath || "resolving…"}</code></div><button className="primary" disabled={saving} onClick={saveSettings}>{saving ? "Saving…" : "Save configuration"}</button></footer></section>;
}

// EmptyWorkspace explains how to point Abduction at local checkouts.
export function EmptyWorkspace({ workspace, onSetup, onSettings }: { workspace: string; onSetup: () => void; onSettings: () => void }) {
  return <section className="empty panel"><AlienGlyph/><h2>No repositories in range</h2><p>Abduction looks for Git checkouts directly inside:</p><code>{workspace}</code><p>Connect another parent folder, or continue with this workspace and clone a repository from the repository picker.</p><div className="empty-actions"><button className="primary" onClick={onSetup}>Choose workspace</button><button className="ghost" onClick={onSettings}>Open settings</button></div></section>;
}
