import { useState } from "react";
import type { InstallCommand } from "../types";

// InstallPill reveals package-manager commands and copies one without executing it.
export function InstallPill({ commands }: { commands: InstallCommand[] }) {
  const [copiedManager, setCopiedManager] = useState("");
  // copyCommand copies an explicit install command and never runs it automatically.
  function copyCommand(installCommand: InstallCommand) {
    navigator.clipboard.writeText(installCommand.command).then(() => { setCopiedManager(installCommand.manager); window.setTimeout(() => setCopiedManager(""), 1400); });
  }
  return <details className="install-pill"><summary>Install <span>⌄</span></summary><div className="install-menu">{commands.map((installCommand) => <button key={installCommand.manager} onClick={() => copyCommand(installCommand)}><strong>{installCommand.manager}</strong><code>{installCommand.command}</code><span>{copiedManager === installCommand.manager ? "Copied" : "Copy"}</span></button>)}</div></details>;
}

