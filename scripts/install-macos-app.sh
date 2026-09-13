#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Northern Lines AIS Route Mapper.app"
SOURCE_APP="$ROOT_DIR/src-tauri/target/release/bundle/macos/$APP_NAME"
TARGET_APP="/Applications/$APP_NAME"

if [[ ! -d "$SOURCE_APP" ]]; then
  echo "Fehler: App-Bundle nicht gefunden:"
  echo "  $SOURCE_APP"
  echo
  echo "Bitte zuerst ausführen:"
  echo "  npm run tauri build"
  exit 1
fi

echo "Installiere $APP_NAME nach /Applications …"
rm -rf "$TARGET_APP"
cp -R "$SOURCE_APP" "$TARGET_APP"

echo "Installiert: $TARGET_APP"
echo "Start mit:"
echo "  open \"$TARGET_APP\""
