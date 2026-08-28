# Changelog

All notable changes to Abduction are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Made `ABDUCTION_BRANCH` explicitly bypass older prebuilt releases and build the requested source branch.
- Made large workspaces appear immediately before repository metadata enrichment finishes.
- Surfaced macOS workspace permission/read errors in the connection wizard.
- Explicitly enabled native macOS zoom and full-screen support.
- Loaded every accessible repository from every GitHub organisation, with clear clone-to-workspace actions for remote-only repositories.
- Added a safe, fast-forward-only Pull latest action for local repositories.
- Added a prominent Pull latest control, manual refresh, and automatic active-repository refresh when commits or working-tree files change in the background.
- Resolved Homebrew's GitHub CLI from macOS GUI apps and surfaced remote-source loading/authentication failures in the repository picker.

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

[Unreleased]: https://github.com/b404dev/Abduction/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/b404dev/Abduction/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/b404dev/Abduction/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/b404dev/Abduction/releases/tag/v0.1.0
