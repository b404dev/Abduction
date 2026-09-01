# Changelog

All notable changes to Abduction are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/b404dev/Abduction/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/b404dev/Abduction/compare/v0.1.2...v0.1.3

## [0.1.2] - 2026-08-28

### Fixed

- Prevented optional CLI version probes or slow repository discovery from blocking the first-boot connection wizard.

## [0.1.1] - 2026-08-27

### Fixed

- Added first-boot workspace setup with a native folder picker and recovery UI for empty workspaces.
- Restored native macOS close, minimize, and full-screen window controls.
- Ensured Wails production builds install the frontend build toolchain with npm 11.

## [0.1.0] - 2026-08-27

### Added

- Native repository browsing, file search, Markdown rendering, and source highlighting.
- Git history, branch switching, repository statistics, and GitHub pull-request views.
- Read-only Codex and Claude analysis with streaming and cancellation.
- Allowlisted local security scanning and linting integrations.
- Linux and macOS configuration, editor launching, themes, and first-run guidance.
- Linux and macOS installation support, with tagged release artifacts.

[Unreleased]: https://github.com/b404dev/Abduction/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/b404dev/Abduction/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/b404dev/Abduction/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/b404dev/Abduction/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/b404dev/Abduction/releases/tag/v0.1.0
