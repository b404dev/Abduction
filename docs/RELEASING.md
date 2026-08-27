# Releasing Abduction

Tagged releases are built and published by GitHub Actions. The release workflow
produces Linux AMD64 and macOS universal archives plus SHA-256 checksums. Both
artifact names match the expectations in `install.sh`. Windows is not a
supported release target.

## Prepare a release

1. Update the version fallback in `app.go` and the version in
   `frontend/package.json` and `frontend/package-lock.json`.
2. Move relevant entries from `Unreleased` into a dated section in
   `CHANGELOG.md` and update its comparison links.
3. Run `make check` and `make build` on a supported development host.
4. Commit the release changes and ensure CI passes on `main`.
5. Create and push an annotated semantic-version tag:

   ```sh
   git tag -a v0.1.1 -m "Abduction v0.1.1"
   git push origin v0.1.1
   ```

6. Confirm both build jobs and the publish job succeed. Smoke-test the attached
   artifact for each available platform and verify the displayed version.

The Go version shown in the application is injected from the tag during
release builds. Do not publish a tag that does not match the changelog and
frontend package version.

## Current distribution limits

Release artifacts are not code-signed or notarized. The one-line installer
supports macOS, Ubuntu/Debian, and Arch-based Linux. Windows is not supported.
