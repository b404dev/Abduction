# Architecture

Abduction is a Go desktop application with a Wails system-WebView shell and a minimal React interface. Privileged host behavior stays testable and the framework stays replaceable.

```text
React views
    │ generated bindings and events
thin Wails App bridge
    │ ordinary Go calls
repository · code · GitHub · tools · analysis · security
```

## Rules

1. Keep it simple. Add a package or dependency only after the current shape demonstrably fails.
2. Every function has a short, plain-English comment explaining its purpose.
3. Never use single-letter variable names.
4. React may render and coordinate views. It may not read arbitrary files or run commands.
5. Go validates every path and argument before touching the host.
6. Commands use argument vectors through `exec.Command`; never construct shell command strings.
7. Outward GitHub actions require an explicit confirmation screen.
8. Claude and Codex run read-only. Abduction never grants write tools or sandbox bypass flags.
9. Long work emits progress events, supports cancellation, and archives partial output.
10. Theme colours, radius, glow, and spacing come from shared tokens.

## Current modules

- `app.go` — narrow Wails binding surface.
- `config.go` — configuration and environment overrides.
- `repository.go` — discovery, safe paths, Git queries, and editor actions.
- `code.go` — bounded reads, Markdown sanitisation, Chroma, and language detection.
- `tools.go` — optional host-tool diagnostics.
- `analysis.go` — read-only Codex and Claude jobs with streamed events.
- `security.go` — allowlisted scanners, cancellation, and report archiving.
- `models.go` — frontend wire contract.
- `frontend/src/App.tsx` — navigation and views.
- `frontend/src/styles.css` — design tokens, themes, layout, and components.
- `frontend/src/security.css` — focused code-search, review, and scanner surfaces.

## Security boundaries

Paths are resolved to absolute paths and must retain the repository root prefix. Files larger than 2 MB are not rendered, binary data is not inserted into the DOM, Markdown is sanitised, and Chroma escapes source.

The Codex provider uses `codex exec --sandbox read-only --json --cd <repository>`. Claude retains its explicit read-only tool allowlist. Provider command construction belongs in one analysis package and receives golden argument tests.

## Platforms

Linux builds use WebKitGTK 4.1 and macOS uses WKWebView. Tagged releases build an Ubuntu AMD64 binary and a macOS universal application bundle in native GitHub-hosted jobs. Windows is not supported. Release artifacts are not currently code-signed or notarized. CSS avoids Chromium-only APIs and respects reduced-motion preferences.
