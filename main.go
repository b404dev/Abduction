package main

import (
	"embed"
	"runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	application := NewApp()

	applicationError := wails.Run(&options.App{
		Title:     "Abduction",
		Width:     1440,
		Height:    900,
		MinWidth:  1040,
		MinHeight: 680,
		Frameless: runtime.GOOS != "darwin",
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 2, G: 3, B: 11, A: 1},
		OnStartup:        application.startup,
		Bind: []interface{}{
			application,
		},
	})

	if applicationError != nil {
		println("Error:", applicationError.Error())
	}
}
