# Changelog

All notable changes to Abduction are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Made the Text & UI scale control resize viewport-relative layout (modals, panes, splash) consistently with everything else, instead of leaving it measured against the real, unscaled window.
- Restored the Open editor executable-path fix that a prior merge silently dropped, and added a macOS fallback that launches the editor's application directly (via `open -a`) when its CLI shim was never added to PATH.

## [0.1.16] - 2026-09-03

### Added

- Added a Text & UI scale control to Settings that resizes the entire desktop chrome, including all text, live in preview.
- Showed the active Git author identity (name and email) for the selected repository in the titlebar, so it is clear which account local commits and pushes will use.

## [0.1.15] - 2026-09-03

### Fixed

- Made Git and GitHub CLI commands (clone, pull latest, branch switching, search, stats, pull requests) use the shared executable lookup so macOS GUI launches can find them in common user and Homebrew locations, matching the earlier fix for security scanners.
- Made the configured editor resolve through the same executable lookup so Open editor works from a macOS GUI launch.
- Added `/usr/bin` to the executable lookup's fallback locations, covering Git and the GitHub CLI on Linux and stock macOS installs.

## [0.1.14] - 2026-09-02

### Added

- Rendered security scan and analysis runs as Markdown reports on disk, with saved copies under the app config directory.

## [0.1.13] - 2026-09-02

### Fixed

- Made Trivy run with a clean Docker config so Docker Desktop credential helpers do not break public database downloads on macOS.

## [0.1.12] - 2026-09-02

### Changed

- Narrowed the documented support matrix to macOS and Omarchy, and focused the platform guardrails on those two environments.

### Fixed

- Made security scan launches use the shared executable lookup and run the resolved binary path so macOS GUI launches can actually start installed scanners.

## [0.1.11] - 2026-09-02

### Fixed

- Made security scanner availability detection use the shared executable lookup so macOS GUI launches can see scanners installed in common user and Homebrew locations.

## [0.1.10] - 2026-09-01

### Added

- Added confirmed pull-request review actions for comments, approvals, and change requests.

### Fixed

- Kept the pull-request list full width until a review is selected instead of squeezing it into an empty master-detail column.
- Expanded selected pull requests into a wider responsive master-detail layout with a taller diff reader.

### Security

- Required an explicit in-app confirmation before every GitHub review write and restricted review commands to validated argument vectors.

## [0.1.9] - 2026-09-01

### Added

- Added pull-request search by author, title, branch, and number.
- Added in-app pull-request drill-down with review state, mergeability, changed-file metrics, and colour-coded unified diffs.
- Added contributor search by name or email on the repository statistics page.
- Added language-composition and repository-activity graphics to the statistics dashboard.

### Security

- Bounded pull-request detail requests with a 45-second timeout and limited rendered diffs to 4 MiB.

## [0.1.8] - 2026-09-01

### Changed

- Split the Wails bridge into lifecycle, repository, and operational modules with explicit ownership boundaries.
- Separated repository discovery, search, local Git operations, and remote GitHub access into focused backend files.
- Reduced the React application root to shared-state orchestration by extracting desktop shell and settings features.

## [0.1.7] - 2026-09-01

### Changed

- Moved the Go application bridge, services, models, and tests into a dedicated `backend` package while retaining a minimal executable entry point.
- Split the repository reader, repository insights, and operational React screens into focused feature modules instead of one monolithic application file.
- Regenerated Wails bindings for the backend package and updated release tooling, architecture documentation, and project checks for the new layout.

## [0.1.6] - 2026-09-01

### Fixed

- Propagated workspace discovery and Git command failures instead of presenting them as empty repository data.
- Reported every concurrent repository statistics query failure instead of returning plausible zero values.
- Surfaced malformed or unreadable configuration files while retaining safe defaults.
- Preserved GitHub command and timeout diagnostics and distinguished missing remote README files from authentication and API failures.
- Reported truncated scanner and analysis output streams and failed security report archives as errors.

## [0.1.5] - 2026-09-01

### Fixed

- Clarified the tree-pane width control so the resize button is easier to read.

## [0.1.4] - 2026-09-01

### Fixed

- Kept deep repository trees inside the file viewer so nested folders no longer disappear under the tree panel.

## [0.1.3] - 2026-09-01

### Fixed

- Made macOS GUI-launched AI provider calls resolve Codex and Claude through the shared executable lookup.
- Made `ABDUCTION_BRANCH` explicitly bypass older prebuilt releases and build the requested source branch.
- Made large workspaces appear immediately before repository metadata enrichment finishes.
- Surfaced macOS workspace permission/read errors in the connection wizard.
- Explicitly enabled native macOS zoom and full-screen support.
- Loaded every accessible repository from every GitHub organisation, with clear clone-to-workspace actions for remote-only repositories.
- Added a safe, fast-forward-only Pull latest action for local repositories.
- Added a prominent Pull latest control, manual refresh, and automatic active-repository refresh when commits or working-tree files change in the background.
- Resolved Homebrew's GitHub CLI from macOS GUI apps and surfaced remote-source loading/authentication failures in the repository picker.
- Prevented remote-source spinners by skipping local metadata enrichment, loading organisations concurrently, and timing out stalled GitHub requests.
- Added fzf-style ordered fuzzy matching and relevance ranking to repository switching and tracked-file search.
- Kept macOS fullscreen titlebar controls outside draggable hit regions so the repository selector remains clickable.
- Opened cloud repositories in a read-only GitHub-backed file browser without cloning, with cloning retained as a separate explicit action.
- Fixed analysis event races and extracted readable assistant prose from current Codex and Claude JSONL event shapes.
- Cached organisation and starred repository catalogues for 30 minutes instead of reloading them whenever the switcher opens.
- Added `C` as a cloud-repository clone shortcut, enabled GitHub-backed remote branch switching, and routed authenticated GitHub clones through `gh repo clone`.
- Preloaded remote branches as one authenticated archive in a bounded read-only memory cache so file browsing is instant after the initial load.
- Hid every editor and local-linter action for remote-only repositories until they are cloned to disk.

[Unreleased]: https://github.com/b404dev/Abduction/compare/v0.1.16...HEAD
[0.1.16]: https://github.com/b404dev/Abduction/compare/v0.1.15...v0.1.16
[0.1.15]: https://github.com/b404dev/Abduction/compare/v0.1.14...v0.1.15
[0.1.14]: https://github.com/b404dev/Abduction/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/b404dev/Abduction/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/b404dev/Abduction/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/b404dev/Abduction/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/b404dev/Abduction/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/b404dev/Abduction/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/b404dev/Abduction/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/b404dev/Abduction/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/b404dev/Abduction/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/b404dev/Abduction/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/b404dev/Abduction/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/b404dev/Abduction/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/b404dev/Abduction/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/b404dev/Abduction/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/b404dev/Abduction/releases/tag/v0.1.0
