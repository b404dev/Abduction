# Contributing to Abduction

Thanks for helping improve Abduction. Before starting a large change, open an
issue so the approach can be agreed without wasted work.

## Development setup

Install Go 1.25+, Node.js 20+, Git, and the
[Wails platform dependencies](https://wails.io/docs/gettingstarted/installation/)
for your operating system. Then run:

```sh
make setup
make check
make dev
```

`make check` runs the Go and frontend tests, Go vet and formatting checks, the
production frontend build, and an installer syntax check. `make doctor` can
help diagnose missing native dependencies.

Keep pull requests focused. Add tests for changed behavior, run `make check`,
and update the README or changelog when user-visible behavior changes. Do not
commit generated frontend output, local binaries, credentials, or repository
data.

By contributing, you agree that your contributions are licensed under the MIT
License.
