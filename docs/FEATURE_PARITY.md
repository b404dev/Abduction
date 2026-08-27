# Feature parity

This ledger compares the original application with the Abduction desktop rewrite. It exists to keep feature work deliberate while the interface stays simple and supportable.

## Available now

- Local workspace discovery, fast repository switching, URL cloning, and branch switching.
- Full repository tree, tracked-content search, syntax-highlighted reading, and a distraction-free focus reader.
- Screen-aware Codex and Claude chat with streamed output and cancellation.
- Real all-reference Git topology, branch and tag decorations, merge parent metadata, named contributors, language composition, and recent authorship.
- GitHub pull-request list, individual security scanners, host-tool detection, application logs, persistent settings, and deep dark themes.

## Next parity work

| Priority | Area | Missing capability | Intended desktop shape |
| --- | --- | --- | --- |
| P0 | Repository sources | GitHub user, organization, starred, and known repositories | Source tabs inside Quick Switch; searchable results show local or clone state. Organization selection must work with authenticated `gh` and support private repositories. |
| P0 | AI learning | Persistent provider sessions and a detachable chat window | Resume a real Codex or Claude session per repository, start fresh deliberately, and share the visible file, selection, branch, and search context. |
| P0 | Reviews | Pull-request detail, diffs, review threads, and review actions | Native detail workspace; all approve, request-changes, comment, and merge actions require explicit confirmation. |
| P0 | Analysis completion | Markdown archive, full-screen result, partial-output persistence, files-read progress, and self-contained HTML chart reports | The dedicated Analysis workspace now restores Codex/Claude selection, security, architecture, quality, and custom presets, clean live streaming, elapsed time, and cancellation. Next, archive every run, retain partial output across restarts, count tool reads, add model/effort/timeout settings, and generate the original accessible inline-SVG HTML report. |
| P1 | Reports | Browse and reopen prior analysis and scan output | Repository-scoped archive with timestamps, provider or scanner, status, and reveal/open actions. |
| P1 | Security | Run one or all scanners and combine results | Queue-based run-all control with one normalized summary and links to raw reports. |
| P1 | Insights | Activity timeline, contributor filtering, and commit filtering | Interactive activity chart connected to the commit list without turning Stats into a dashboard wall. |
| P2 | Explorer | Expand or collapse all and fuzzy file jump | Compact tree controls and keyboard-first file picker. |
| P2 | Repository library | Pins and favorites | Pinned repositories lead Quick Switch and persist in configuration. |
| P2 | Clone policy | Shallow or full clones and optional cache location | Advanced disclosure below Clone; full workspace clone remains the safe default. |
| P2 | Guidance | About, shortcuts, tool help, and account activity | Searchable Help workspace and contextual empty states. |

## Guardrails

- GitHub organization support uses the authenticated GitHub CLI rather than storing tokens in Abduction.
- Read operations stay automatic; remote writes and review actions always ask for confirmation.
- New Go functions use descriptive names, plain-English comments, and no single-letter variables.
- Platform-specific behavior must remain supported on Arch Linux, Ubuntu, and macOS.
