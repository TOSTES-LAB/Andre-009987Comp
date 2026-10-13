#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PC_TEST_ROOT="${PC_TEST_ROOT:-$(mktemp -d "${TMPDIR:-/tmp}/andrecomp-clean-install-git.XXXXXX")}"
PC_HOME="${PC_HOME:-$PC_TEST_ROOT/home}"
PC_CACHE="${PC_CACHE:-$PC_TEST_ROOT/npm-cache}"
KEEP_TEMP="${KEEP_TEMP:-0}"

cleanup() {
  if [ "$KEEP_TEMP" != "1" ]; then
    rm -rf "$PC_TEST_ROOT"
  fi
}
trap cleanup EXIT

mkdir -p "$PC_HOME" "$PC_CACHE"

echo "REPO_ROOT: $REPO_ROOT"
echo "PC_TEST_ROOT: $PC_TEST_ROOT"
echo "PC_HOME: $PC_HOME"

env \
  HOME="$PC_HOME" \
  ANDRECOMP_HOME="$PC_HOME/.andrecomp" \
  npm_config_cache="$PC_CACHE" \
  npm_config_userconfig="$PC_HOME/.npmrc" \
  PATH="$PC_HOME/.local/bin:$PATH" \
  pnpm --dir "$REPO_ROOT" andrecomp install --yes

test -x "$PC_HOME/.local/bin/andrecomp"
test -L "$PC_HOME/.andrecomp/cli/current"
test -f "$PC_HOME/.andrecomp/cli/install.json"

env HOME="$PC_HOME" ANDRECOMP_HOME="$PC_HOME/.andrecomp" PATH="$PC_HOME/.local/bin:$PATH" andrecomp --version
env HOME="$PC_HOME" ANDRECOMP_HOME="$PC_HOME/.andrecomp" PATH="$PC_HOME/.local/bin:$PATH" andrecomp doctor \
  --config "$PC_TEST_ROOT/missing-config.json" >/dev/null || true

env \
  HOME="$PC_HOME" \
  ANDRECOMP_HOME="$PC_HOME/.andrecomp" \
  PATH="$PC_HOME/.local/bin:$PATH" \
  pnpm --dir "$REPO_ROOT" andrecomp uninstall

test ! -e "$PC_HOME/.andrecomp/cli"
test ! -e "$PC_HOME/.local/bin/andrecomp"
