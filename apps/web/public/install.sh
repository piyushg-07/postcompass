#!/bin/sh
# PostCompass installer for macOS and Linux.
#
#   curl -fsSL https://www.postcompass.cloud/install.sh | sh
#
# Installs the latest release:
#   macOS  the .dmg for your chip (Apple Silicon or Intel), copied to Applications
#   Linux  the AppImage in ~/.local/bin with a menu entry (no sudo; it updates itself)
# curl doesn't quarantine what it downloads, so macOS opens the app without the
# "Open Anyway" step a browser download needs.

set -eu

REPO="piyushg-07/postcompass"

say() { printf '%s\n' "$*"; }
fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required."

# Latest release version, e.g. "0.1.0"
VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" |
  sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p' | head -n 1)
[ -n "$VERSION" ] || fail "Couldn't find the latest release. Download it from https://github.com/$REPO/releases"
BASE="https://github.com/$REPO/releases/download/v$VERSION"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

install_macos() {
  case "$(uname -m)" in
    arm64) FILE="PostCompass_${VERSION}_aarch64.dmg" ;;
    x86_64) FILE="PostCompass_${VERSION}_x64.dmg" ;;
    *) fail "Unsupported Mac: $(uname -m)" ;;
  esac

  say "Downloading PostCompass $VERSION for macOS..."
  curl -fL --progress-bar "$BASE/$FILE" -o "$TMP/$FILE"

  MOUNT="$TMP/mount"
  mkdir -p "$MOUNT"
  hdiutil attach -nobrowse -quiet -mountpoint "$MOUNT" "$TMP/$FILE"

  # /Applications when it's writable (the usual case), otherwise ~/Applications
  DEST="/Applications"
  [ -w "$DEST" ] || DEST="$HOME/Applications"
  mkdir -p "$DEST"
  rm -rf "$DEST/PostCompass.app"
  cp -R "$MOUNT/PostCompass.app" "$DEST/"
  hdiutil detach -quiet "$MOUNT"

  say "Installed to $DEST/PostCompass.app"
  open "$DEST/PostCompass.app"
}

install_linux() {
  [ "$(uname -m)" = "x86_64" ] || fail "PostCompass for Linux needs a 64-bit (x86_64) system."
  FILE="PostCompass_${VERSION}_amd64.AppImage"
  BIN_DIR="$HOME/.local/bin"
  APP_DIR="$HOME/.local/share/applications"
  ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"
  BIN="$BIN_DIR/postcompass"
  mkdir -p "$BIN_DIR" "$APP_DIR" "$ICON_DIR"

  say "Downloading PostCompass $VERSION for Linux..."
  curl -fL --progress-bar "$BASE/$FILE" -o "$TMP/$FILE"
  # The in-app updater replaces this file in place, so it stays where it's installed
  mv "$TMP/$FILE" "$BIN"
  chmod 755 "$BIN"

  # Menu entry and icon (the icon is optional; the entry works without it)
  curl -fsSL "https://www.postcompass.cloud/icon.png" -o "$ICON_DIR/postcompass.png" 2>/dev/null || true
  cat >"$APP_DIR/postcompass.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=PostCompass
Comment=A fast, modern desktop app for PostgreSQL
Exec=$BIN
Icon=postcompass
Categories=Development;Database;
Terminal=false
EOF

  say "Installed to $BIN"
  say "Open PostCompass from your app menu, or run: postcompass"

  # AppImages need FUSE 2, which newer Ubuntu releases don't install by default
  if ! (ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'); then
    say ""
    say "Note: PostCompass needs FUSE 2. If it doesn't start, install it:"
    say "  Ubuntu 24.04+:    sudo apt install libfuse2t64"
    say "  Ubuntu / Debian:  sudo apt install libfuse2"
    say "  Fedora:           sudo dnf install fuse-libs"
  fi

  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) say "Tip: add $BIN_DIR to your PATH to run 'postcompass' from any terminal." ;;
  esac
}

case "$(uname -s)" in
  Darwin) install_macos ;;
  Linux) install_linux ;;
  *) fail "This installer is for macOS and Linux. On Windows, run in PowerShell: irm https://www.postcompass.cloud/install.ps1 | iex" ;;
esac
