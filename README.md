# Abduction

[![CI](https://github.com/b404dev/Abduction/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/b404dev/Abduction/actions/workflows/ci.yml?query=branch%3Amain)
[![Release](https://img.shields.io/github/v/release/b404dev/Abduction?cacheSeconds=60)](https://github.com/b404dev/Abduction/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Abduction is a native repository cockpit for browsing, understanding, reviewing, and securing local codebases. It combines a Go host engine with a Wails interface and a distinctly extraterrestrial visual system.

> Abduction is currently an early `v0.1.2` release. Back up important work and review commands before running them.

## Installation

```sh
curl -fsSL https://raw.githubusercontent.com/b404dev/Abduction/main/install.sh | bash
```

The installer is supported on macOS and Omarchy. It prefers a matching GitHub release, falls back to a source build, installs required platform packages, and adds Abduction to the desktop application launcher.

Review [`install.sh`](install.sh) before piping it to a shell. By default it installs the latest published release. To force a source build from a branch, pass `ABDUCTION_BRANCH` to the receiving shell:

```sh
curl -fsSL https://raw.githubusercontent.com/b404dev/Abduction/main/install.sh | ABDUCTION_BRANCH=main bash
```

## What it does

- Fast repository switching, tracked-file exploration, and code search.
- Rich Markdown rendering and syntax-highlighted source reading.
- Git history, branch switching, repository statistics, and pull requests.
- Screen-aware Codex and Claude chat with streaming and cancellation.
- Local security scans through allowlisted tools.
- Native editor and GitHub actions.
- Twenty-two complete visual themes, including Lost Mary.
- Randomized ASCII abduction splash scenes and UFO loading states.

Optional integrations remain unavailable until their command-line tools are installed. The local code reader does not depend on them.

## Development

You need Go 1.25+, Node.js 24+, Git, and the [Wails platform dependencies](https://wails.io/docs/gettingstarted/installation/). On Linux this includes GTK3 and WebKitGTK 4.1; macOS requires the Xcode command-line tools.

```sh
make dev
```

Build and test with:

```sh
make test
make check
make build
make doctor
```

For a browser smoke pass against the mocked frontend harness, run:

```sh
cd frontend && npm run test:e2e
```

Abduction uses the first existing workspace among `~/Github`, `~/GitHub`, `~/Projects`, `~/projects`, and `~/code`. Override it with `REAPER_WORKSPACE_PATH=/your/repositories`.

## Configuration

Preferences are stored in the platform configuration directory under `reaper/config.json` for compatibility with earlier builds:

```json
{"workspace":"/home/you/Github","editor":"code","theme":"lost-mary"}
```

`REAPER_WORKSPACE_PATH` and `REAPER_EDITOR` override the saved values. Editor arguments are passed directly without invoking a shell.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before making structural changes. The sources and editorial rules behind the encounter-themed splash copy are documented in [`docs/UAP_RESEARCH.md`](docs/UAP_RESEARCH.md).

## Contributing and support

Bug reports and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing and [SECURITY.md](SECURITY.md) before reporting a vulnerability. Release history is recorded in [CHANGELOG.md](CHANGELOG.md), and maintainer release steps are in [docs/RELEASING.md](docs/RELEASING.md).

Abduction is available under the [MIT License](LICENSE).
