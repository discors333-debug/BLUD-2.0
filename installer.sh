#!/usr/bin/env bash
set -euo pipefail

ALIAS_LINE='alias blud="cowsay BLUD MANGOOOOO"'

# Detect the user's shell and the matching rc file.
shell_name="$(basename "${SHELL:-}")"
case "$shell_name" in
  zsh)  RC="$HOME/.zshrc" ;;
  bash) RC="$HOME/.bashrc" ;;
  *)
    echo "Unsupported or unknown shell '$shell_name' (\$SHELL=$SHELL)." >&2
    echo "Only zsh and bash are supported right now." >&2
    exit 1
    ;;
esac

# Install cowsay if it's missing, using whatever package manager is available.
if ! command -v cowsay &>/dev/null; then
  echo "cowsay not found, installing..."
  if command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm cowsay
  elif command -v apt-get &>/dev/null; then
    sudo apt-get update && sudo apt-get install -y cowsay
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y cowsay
  elif command -v apk &>/dev/null; then
    sudo apk add cowsay
  elif command -v brew &>/dev/null; then
    brew install cowsay
  else
    echo "No supported package manager found. Install cowsay manually." >&2
    exit 1
  fi
fi

# Add or update the alias in the detected rc file.
if grep -qxF "$ALIAS_LINE" "$RC" 2>/dev/null; then
  echo "Alias already set up in $RC"
elif grep -q '^alias blud=' "$RC" 2>/dev/null; then
  cp "$RC" "$RC.bak.$(date +%Y%m%d%H%M%S)"
  sed -i "s|^alias blud=.*|$ALIAS_LINE|" "$RC"
  echo "Updated existing blud alias in $RC (backup saved)."
else
  printf '\n%s\n' "$ALIAS_LINE" >> "$RC"
  echo "Added blud alias to $RC"
fi

echo "Run 'source $RC' or restart your shell to use it."
