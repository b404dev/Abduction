#!/usr/bin/env bash
set -euo pipefail

readonly REPOSITORY="b404dev/Abduction"
readonly BRANCH="${ABDUCTION_BRANCH:-main}"
readonly FORCE_SOURCE="${ABDUCTION_BRANCH:+true}"
readonly INSTALL_BIN="${HOME}/.local/bin"
temporary_directory=""

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }
cleanup() { [[ -n "${temporary_directory}" ]] && rm -rf -- "${temporary_directory}"; }
trap cleanup EXIT
command_exists() { command -v "$1" >/dev/null 2>&1; }
run_as_root() { if [[ "$(id -u)" -eq 0 ]]; then "$@"; else command_exists sudo || fail "sudo is required to install build dependencies"; sudo "$@"; fi; }

detect_host() {
  case "$(uname -s)" in
    Darwin) host_os="macos"; package_family="brew" ;;
    Linux)
      [[ -r /etc/os-release ]] || fail "Linux distribution could not be identified"
      # shellcheck disable=SC1091
      . /etc/os-release
      case "${ID:-}" in
        ubuntu|debian) host_os="linux"; package_family="apt" ;;
        arch|manjaro|endeavouros) host_os="linux"; package_family="pacman" ;;
        *)
          case " ${ID_LIKE:-} " in
            *" debian "*) host_os="linux"; package_family="apt" ;;
            *" arch "*) host_os="linux"; package_family="pacman" ;;
            *) fail "Supported hosts are macOS, Ubuntu/Debian, and Arch-based Linux (found ${ID:-unknown})" ;;
          esac
          ;;
      esac
      ;;
    *) fail "Unsupported operating system: $(uname -s)" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) host_arch="amd64" ;;
    arm64|aarch64) host_arch="arm64" ;;
    *) fail "Unsupported CPU architecture: $(uname -m)" ;;
  esac
}

install_linux_files() {
  local binary="$1" icon="$2"
  local data_home="${XDG_DATA_HOME:-${HOME}/.local/share}"
  local applications="${data_home}/applications"
  local icons="${data_home}/icons/hicolor/512x512/apps"
  mkdir -p "${INSTALL_BIN}" "${applications}" "${icons}"
  install -m 0755 "${binary}" "${INSTALL_BIN}/abduction"
  [[ -f "${icon}" ]] && install -m 0644 "${icon}" "${icons}/abduction.png"
  cat >"${applications}/abduction.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=Abduction
GenericName=Repository Cockpit
Comment=Browse, understand, review, and secure local repositories
Exec=${INSTALL_BIN}/abduction
Icon=abduction
Terminal=false
Categories=Development;IDE;
StartupNotify=true
StartupWMClass=abduction
DESKTOP
  command_exists update-desktop-database && update-desktop-database "${applications}" >/dev/null 2>&1 || true
}

install_runtime_dependencies() {
  [[ "${host_os}" == "macos" ]] && return
  say "Installing ${package_family} desktop runtime"
  case "${package_family}" in
    apt)
      run_as_root apt-get update
      run_as_root apt-get install -y --no-install-recommends ca-certificates libgtk-3-0 libwebkit2gtk-4.1-0
      ;;
    pacman)
      run_as_root pacman -Syu --needed --noconfirm ca-certificates gtk3 webkit2gtk-4.1
      ;;
  esac
}

try_release_install() {
  local suffix="${host_os}-${host_arch}"
  local archive="${temporary_directory}/abduction-${suffix}.tar.gz"
  say "Looking for a prebuilt ${suffix} release"
  curl -fsSL -o "${archive}" "https://github.com/${REPOSITORY}/releases/latest/download/abduction-${suffix}.tar.gz" || return 1
  tar -xzf "${archive}" -C "${temporary_directory}" || return 1
  if [[ "${host_os}" == "macos" ]]; then
    local app_bundle
    app_bundle="$(find "${temporary_directory}" -maxdepth 2 -name 'Abduction.app' -type d -print -quit)"
    [[ -n "${app_bundle}" ]] || return 1
    mkdir -p "${HOME}/Applications"
    rm -rf -- "${HOME}/Applications/Abduction.app"
    cp -R "${app_bundle}" "${HOME}/Applications/Abduction.app"
  else
    local binary
    binary="$(find "${temporary_directory}" -maxdepth 2 -name abduction -type f -print -quit)"
    [[ -n "${binary}" ]] || return 1
    install_linux_files "${binary}" "${temporary_directory}/abduction.png"
  fi
}

install_build_dependencies() {
  say "Installing ${package_family} build dependencies"
  case "${package_family}" in
    apt)
      run_as_root apt-get update
      run_as_root apt-get install -y --no-install-recommends ca-certificates curl git build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev golang-go nodejs npm
      ;;
    pacman)
      run_as_root pacman -Syu --needed --noconfirm base-devel ca-certificates curl git go nodejs npm pkgconf gtk3 webkit2gtk-4.1
      ;;
    brew)
      command_exists brew || fail "Homebrew is required. Install it from https://brew.sh and retry."
      command_exists xcode-select && xcode-select -p >/dev/null 2>&1 || fail "Run 'xcode-select --install' first, then retry."
      brew install go node git pkg-config
      ;;
  esac
}

build_source() {
  install_build_dependencies
  local archive="${temporary_directory}/source.tar.gz"
  local source_directory="${temporary_directory}/source"
  say "Downloading ${REPOSITORY}@${BRANCH}"
  curl -fsSL -o "${archive}" "https://github.com/${REPOSITORY}/archive/refs/heads/${BRANCH}.tar.gz"
  mkdir -p "${source_directory}"
  tar -xzf "${archive}" -C "${source_directory}" --strip-components=1
  say "Building Abduction"
  (cd "${source_directory}/frontend" && npm ci)
  (cd "${source_directory}" && GOBIN="${temporary_directory}/tools" go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0)
  if [[ "${host_os}" == "macos" ]]; then
    (cd "${source_directory}" && "${temporary_directory}/tools/wails" build -platform darwin/universal)
    local app_bundle
    app_bundle="$(find "${source_directory}/build/bin" -maxdepth 1 -name '*.app' -type d -print -quit)"
    [[ -n "${app_bundle}" ]] || fail "macOS application bundle was not produced"
    mkdir -p "${HOME}/Applications"
    rm -rf -- "${HOME}/Applications/Abduction.app"
    cp -R "${app_bundle}" "${HOME}/Applications/Abduction.app"
  else
    (cd "${source_directory}" && "${temporary_directory}/tools/wails" build -tags webkit2_41)
    install_linux_files "${source_directory}/build/bin/abduction" "${source_directory}/build/linux/reaper-512.png"
  fi
}

main() {
  command_exists curl || fail "curl is required"
  command_exists tar || fail "tar is required"
  detect_host
  temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/abduction-install.XXXXXX")"
  say "Detected ${host_os}/${host_arch} (${package_family})"
  install_runtime_dependencies
  if [[ "${FORCE_SOURCE}" == "true" ]]; then
    say "Source branch requested; skipping prebuilt releases"
    build_source
  elif ! try_release_install; then
    say "No matching release found; building from source"
    build_source
  fi
  say "Abduction installed successfully"
  [[ "${host_os}" == "linux" ]] && printf 'Run: %s/abduction\n' "${INSTALL_BIN}"
  [[ "${host_os}" == "macos" ]] && printf 'Open: %s\n' "${HOME}/Applications/Abduction.app"
}

main "$@"
