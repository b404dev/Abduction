# Abduction project instructions

This repo prefers a simple, repeatable flow for feature and release work.

## Default work pattern

- Start from `main` and create a branch for the change.
- Keep each run to one feature or one fix.
- Prefer a PR for delivery.
- Verify with real project commands, not just descriptions.
- For bug fixes, add a regression test before or alongside the fix when feasible.

## Release flow

When the user wants a release instead of a PR, follow the documented release process:

1. Update `backend/app.go`, `frontend/package.json`, and `frontend/package-lock.json` if the project version changed.
2. Move changelog entries from `Unreleased` into a dated release section.
3. Run `make check` and `make build`.
4. Commit the release changes on `main`.
5. Create an annotated semantic-version tag.
6. Push the tag.
7. Publish a GitHub release and verify it exists.

See `docs/RELEASING.md` for the canonical repo-specific release steps.

## When a new chat starts

If the user asks for a new feature or fix, treat this repo as the current project context and use the release/PR flow above without asking them to restate the basics.
