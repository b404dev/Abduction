package main

import (
	"embed"
	"runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	macoptions "github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	application := NewApp()

	applicationError := wails.Run(&options.App{
		Title:     "Abduction",
		Width:     1280,
		Height:    800,
		MinWidth:  720,
		MinHeight: 520,
		Frameless: runtime.GOOS != "darwin",
		Mac: &macoptions.Options{
			TitleBar:    macoptions.TitleBarDefault(),
			DisableZoom: false,
			Preferences: &macoptions.Preferences{FullscreenEnabled: macoptions.Enabled},
		},
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
