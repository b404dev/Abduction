.PHONY: setup dev build test doctor
WAILS ?= $(shell go env GOPATH)/bin/wails
setup:
	cd frontend && npm install
	@test -x "$(WAILS)" || go install github.com/wailsapp/wails/v2/cmd/wails@latest
dev: setup
	"$(WAILS)" dev -tags webkit2_41
build:
	"$(WAILS)" build -tags webkit2_41
test:
	go test ./...
	cd frontend && npm run build
doctor:
	"$(WAILS)" doctor
