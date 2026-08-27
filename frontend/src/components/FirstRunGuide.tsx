import { useState } from "react";

type FirstRunGuideProps = {
  onClose: () => void;
  setupRequired?: boolean;
  workspace?: string;
  onBrowse?: () => Promise<string>;
  onConnect?: (workspace: string) => Promise<number>;
};

export function FirstRunGuide({ onClose, setupRequired = false, workspace = "", onBrowse, onConnect }: FirstRunGuideProps) {
  const [draftWorkspace, setDraftWorkspace] = useState(workspace);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function browse() {
    if (!onBrowse) return;
    setMessage("");
    try {
      const selectedWorkspace = await onBrowse();
      if (selectedWorkspace) setDraftWorkspace(selectedWorkspace);
    } catch (reason) {
      setMessage(String(reason));
    }
  }

  async function connect() {
    if (!onConnect || !draftWorkspace.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const repositoryCount = await onConnect(draftWorkspace.trim());
      if (repositoryCount > 0) onClose();
      else setMessage("Workspace connected. No Git repositories were found directly inside this folder; you can continue and clone one.");
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setSaving(false);
    }
  }

  if (setupRequired) return <div className="guide-backdrop"><section className="first-run-guide first-run-setup" role="dialog" aria-modal="true" aria-labelledby="guide-title"><span className="eyebrow">First contact</span><h2 id="guide-title">Connect your repositories</h2><p>Choose the parent folder that contains your local Git repositories. Abduction only reads folders you connect.</p><div className="workspace-setup-field"><label htmlFor="workspace-path">Repository workspace</label><div><input id="workspace-path" autoFocus value={draftWorkspace} onChange={(event) => setDraftWorkspace(event.target.value)} placeholder="/Users/you/Github"/><button className="ghost" onClick={browse}>Browse…</button></div></div>{message ? <p className="workspace-setup-message" role="status">{message}</p> : null}<div className="setup-notes"><article><b>1</b><strong>Pick a parent folder</strong><span>Select the folder containing your repository directories, not an individual repository.</span></article><article><b>2</b><strong>Keep control</strong><span>Your workspace stays on this Mac. Optional tools remain disabled until installed.</span></article><article><b>3</b><strong>Change it later</strong><span>Workspace and editor settings remain available from Settings at any time.</span></article></div><footer><small>You can connect an empty folder and clone a repository next.</small><div>{message.startsWith("Workspace connected") ? <button className="ghost" onClick={onClose}>Continue</button> : null}<button className="primary" disabled={!draftWorkspace.trim() || saving} onClick={connect}>{saving ? "Connecting…" : "Connect workspace"}</button></div></footer></section></div>;

  return <div className="guide-backdrop"><section className="first-run-guide" role="dialog" aria-modal="true" aria-labelledby="guide-title"><span className="eyebrow">First contact</span><h2 id="guide-title">Understand any repository fast</h2><p>Abduction keeps the unusual language, but the workflow is simple.</p><div><article><b>1</b><strong>Choose a signal</strong><span>Switch repositories with Ctrl/⌘ P, including your own, organisation, and starred sources.</span></article><article><b>2</b><strong>Search the evidence</strong><span>Use Filenames or In files. Toggle .* when you need a regular expression.</span></article><article><b>3</b><strong>Extract meaning</strong><span>Read history, inspect dependencies and security, or ask AI about the active file.</span></article></div><footer><small>Press ? any time for keyboard controls.</small><button autoFocus className="primary" onClick={onClose}>Begin encounter</button></footer></section></div>;
}
