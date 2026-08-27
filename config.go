package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

// LoadConfig reads user preferences and applies environment overrides.
func LoadConfig() Config {
	userHome, homeError := os.UserHomeDir()
	if homeError != nil {
		userHome = "."
	}
	configuration := Config{Workspace: DefaultWorkspace(userHome), Editor: "code", Theme: "reaper-dark", Glow: 1.4, Radius: 16, Glass: 0.82}
	configurationBytes, readError := os.ReadFile(filepath.Join(ConfigDirectory(), "config.json"))
	if readError == nil {
		_ = json.Unmarshal(configurationBytes, &configuration)
	}
	if workspace := os.Getenv("REAPER_WORKSPACE_PATH"); workspace != "" {
		configuration.Workspace = workspace
	}
	if editor := os.Getenv("REAPER_EDITOR"); editor != "" {
		configuration.Editor = editor
	}
	return NormalizeConfig(configuration)
}

// NormalizeConfig fills missing appearance values and bounds unsafe extremes.
func NormalizeConfig(configuration Config) Config {
	if !IsDarkTheme(configuration.Theme) {
		configuration.Theme = "reaper-dark"
	}
	if configuration.Glow <= 0 {
		configuration.Glow = 1.4
	}
	if configuration.Glow > 2.5 {
		configuration.Glow = 2.5
	}
	if configuration.Radius < 10 {
		configuration.Radius = 16
	}
	if configuration.Radius > 28 {
		configuration.Radius = 28
	}
	if configuration.Glass < 0.55 || configuration.Glass > 0.96 {
		configuration.Glass = 0.82
	}
	return configuration
}

// IsDarkTheme reports whether a theme is approved for sustained code reading.
func IsDarkTheme(themeName string) bool {
	darkThemes := map[string]bool{
		"reaper-dark": true, "reaper-blood": true, "reaper-void": true,
		"tokyo-night": true, "tokyo-neon": true, "tokyo-dusk": true,
		"matte-black": true, "matte-ember": true, "matte-ice": true,
		"hackerman": true, "hackerman-amber": true, "hackerman-ghost": true,
		"catppuccin-mocha": true, "catppuccin-macchiato": true, "catppuccin-frappe": true, "catppuccin-latte": true,
		"everforest": true, "gruvbox": true, "kanagawa": true, "nord": true, "rose-pine": true,
		"lost-mary": true,
	}
	return darkThemes[themeName]
}

// SaveConfig validates and atomically persists desktop preferences.
func SaveConfig(configuration Config) (Config, error) {
	configuration = NormalizeConfig(configuration)
	workspaceInfo, workspaceError := os.Stat(configuration.Workspace)
	if workspaceError != nil || !workspaceInfo.IsDir() {
		return Config{}, errors.New("workspace must be an existing directory")
	}
	if configuration.Editor == "" {
		return Config{}, errors.New("editor command cannot be empty")
	}
	configurationDirectory := ConfigDirectory()
	if makeError := os.MkdirAll(configurationDirectory, 0o755); makeError != nil {
		return Config{}, makeError
	}
	configurationBytes, marshalError := json.MarshalIndent(configuration, "", "  ")
	if marshalError != nil {
		return Config{}, marshalError
	}
	temporaryPath := filepath.Join(configurationDirectory, "config.json.tmp")
	if writeError := os.WriteFile(temporaryPath, configurationBytes, 0o600); writeError != nil {
		return Config{}, writeError
	}
	if renameError := os.Rename(temporaryPath, filepath.Join(configurationDirectory, "config.json")); renameError != nil {
		return Config{}, renameError
	}
	return configuration, nil
}

// DefaultWorkspace selects the first conventional repository folder that exists.
func DefaultWorkspace(userHome string) string {
	candidates := []string{"Github", "GitHub", "Projects", "projects", "code"}
	for _, candidate := range candidates {
		candidatePath := filepath.Join(userHome, candidate)
		if directoryInfo, statError := os.Stat(candidatePath); statError == nil && directoryInfo.IsDir() {
			return candidatePath
		}
	}
	return filepath.Join(userHome, "code")
}

// ConfigDirectory returns Abduction's legacy-compatible configuration folder.
func ConfigDirectory() string {
	baseDirectory, directoryError := os.UserConfigDir()
	if directoryError != nil {
		return ".reaper"
	}
	return filepath.Join(baseDirectory, "reaper")
}
