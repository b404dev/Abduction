# reaper desktop

A native GitHub cockpit for browsing, understanding, reviewing, and securing every repository you work with. Reaper combines a Go host engine with a rich Wails interface for Arch Linux, Ubuntu, and macOS.

## Quick start

You need Go 1.25+, Node 20+, Git, and the Linux WebKitGTK development package or macOS Xcode command-line tools.

```sh
make dev
```

That single command installs the frontend dependencies, installs Wails when missing, generates bindings, and starts the desktop app with hot reload. On first run Reaper uses the first existing workspace among `~/Github`, `~/GitHub`, `~/Projects`, `~/projects`, and `~/code`. Point it elsewhere with `REAPER_WORKSPACE_PATH="/your/repositories" make dev`.

Build a release with `make build`. The result is written to `build/bin/reaper` on Linux or a Reaper application bundle on macOS.

## Desktop features

- Compact icon rail with contextual repository shelf.
- Top-bar repository switching with search and keyboard shortcuts.
- Safe lazy file-tree browsing.
- Fast repository-wide tracked-code search.
- Rich Markdown README and document rendering.
- Chroma syntax highlighting with line numbers and Catppuccin palettes.
- Recent Git history plus safe local and remote branch switching.
- Screen-aware Codex and Claude chat with streaming and cancellation.
- GitHub pull-request discovery through the authenticated `gh` CLI.
- Allowlisted gitleaks, OSV-Scanner, gosec, Trivy, and Semgrep runs with archived reports.
- Native editor and GitHub actions.
- Host diagnostics for Git, GitHub CLI, Claude, Codex, and security scanners.
- Reaper, Catppuccin Mocha, Macchiato, Frappé, and Latte themes.

Optional integrations appear as unavailable when their command-line tools are not installed. Reaper's local code reader never depends on them.

## Configuration

Reaper reads `$XDG_CONFIG_HOME/reaper/config.json` on Linux and the equivalent macOS directory:

```json
{"workspace":"/home/you/Github","editor":"code","theme":"reaper-dark"}
```

`REAPER_WORKSPACE_PATH` and `REAPER_EDITOR` override the file. Reaper passes editor arguments directly and never invokes a shell.

## Development

```sh
make test
make doctor
make build
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before adding a feature.
