#!/usr/bin/env bash
set -euo pipefail

# Detect the user's shell and the matching rc file (same logic as installer.sh).
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

# Remove the blud alias line from the rc file.
if grep -q '^alias blud=' "$RC" 2>/dev/null; then
  cp "$RC" "$RC.bak.$(date +%Y%m%d%H%M%S)"
  sed -i '/^alias blud=/d' "$RC"
  echo "Removed blud alias from $RC (backup saved)."
else
  echo "No blud alias found in $RC"
fi

# Optionally remove cowsay too.
if command -v cowsay &>/dev/null; then
  read -rp "Also uninstall cowsay? [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    if command -v pacman &>/dev/null; then
      sudo pacman -Rns --noconfirm cowsay
    elif command -v apt-get &>/dev/null; then
      sudo apt-get remove -y cowsay
    elif command -v dnf &>/dev/null; then
      sudo dnf remove -y cowsay
    elif command -v apk &>/dev/null; then
      sudo apk del cowsay
    elif command -v brew &>/dev/null; then
      brew uninstall cowsay
    else
      echo "No supported package manager found. Remove cowsay manually." >&2
    fi
  fi
fi

echo "Run 'source $RC' or restart your shell for the change to take effect."
