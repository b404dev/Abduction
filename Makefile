.PHONY: setup dev build test check doctor
WAILS ?= $(shell go env GOPATH)/bin/wails
setup:
	cd frontend && npm install --include=dev
	@test -x "$(WAILS)" || go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
dev: setup
	"$(WAILS)" dev -tags webkit2_41
build:
	"$(WAILS)" build -tags webkit2_41
test:
	cd frontend && npm test
	cd frontend && npm run build
	go test ./...
check: test
	go vet ./...
	test -z "$$(gofmt -l -- *.go backend/*.go)"
	bash -n install.sh
doctor:
	"$(WAILS)" doctor
