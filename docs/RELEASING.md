# Releasing Abduction

Tagged releases are built and published by GitHub Actions. The release workflow
produces Omarchy/Linux AMD64 and macOS universal archives plus SHA-256
checksums. Both artifact names match the expectations in `install.sh`.
Windows is not a supported release target.

## Preferred release flow

This project is usually shipped the same way:

1. Branch from `main`.
2. Keep the change to one feature or fix.
3. Verify with real build/test output before claiming success.
4. Open a PR and let CI go green.
5. If the user wants a direct release instead of a PR, merge to `main`
   deliberately, then tag and publish the release.
6. Only after the release is published, clean up the branch.

## Prepare a release

1. Update the version fallback in `backend/app.go` and the version in
   `frontend/package.json` and `frontend/package-lock.json`.
2. Move relevant entries from `Unreleased` into a dated section in
   `CHANGELOG.md` and update its comparison links.
3. Run `make check` and `make build` on a supported development host.
4. Commit the release changes and ensure CI passes on `main`.
5. Create and push an annotated semantic-version tag:

   ```sh
   git tag -a v0.1.2 -m "Abduction v0.1.2"
   git push origin v0.1.2
   ```

6. Confirm both build jobs and the publish job succeed. Smoke-test the attached
   artifact for each available platform and verify the displayed version.

The Go version shown in the application is injected from the tag during
release builds. Do not publish a tag that does not match the changelog and
frontend package version.

## Current distribution limits

Release artifacts are not code-signed or notarized. The one-line installer is
supported on macOS and Omarchy. Windows is not supported.
