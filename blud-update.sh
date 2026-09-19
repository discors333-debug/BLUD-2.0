#!/usr/bin/env bash
# Finds the latest BLUD-X.Y repo on the GitHub profile below, downloads its
# installer.sh/uninstaller.sh, and runs the installer to (re)install the
# `blud` alias. Re-run any time to update to the newest version.
set -euo pipefail

GH_USER="discors333-debug"
INSTALL_DIR="$HOME/.local/share/blud"

command -v curl &>/dev/null || { echo "curl is required." >&2; exit 1; }

echo "Checking $GH_USER's GitHub repos for the latest BLUD version..."

repos_json="$(curl -sf "https://api.github.com/users/$GH_USER/repos?per_page=100")"

# Pick the highest-numbered "BLUD-X.Y" repo name.
latest_repo="$(
  grep -o '"name": *"BLUD-[0-9][0-9.]*"' <<<"$repos_json" \
    | sed -E 's/.*"(BLUD-[0-9.]+)"/\1/' \
    | sort -t- -k2 -V \
    | tail -n1
)"

if [[ -z "$latest_repo" ]]; then
  echo "No BLUD-X.Y repo found on github.com/$GH_USER." >&2
  exit 1
fi

echo "Latest version found: $latest_repo"

raw_base="https://raw.githubusercontent.com/$GH_USER/$latest_repo/main"

mkdir -p "$INSTALL_DIR"

for f in installer.sh uninstaller.sh; do
  echo "Downloading $f..."
  curl -sf "$raw_base/$f" -o "$INSTALL_DIR/$f"
  chmod +x "$INSTALL_DIR/$f"
done

echo "Running installer from $latest_repo..."
"$INSTALL_DIR/installer.sh"

echo "$latest_repo" > "$INSTALL_DIR/VERSION"
echo "Done. Installed/updated to $latest_repo."
echo "Installer and uninstaller kept in $INSTALL_DIR (run uninstaller.sh from there to remove)."
