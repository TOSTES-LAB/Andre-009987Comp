#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PC_INSTALL_DRIVER="${PC_INSTALL_DRIVER:-source}"

PC_TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/andrecomp-clean-install.XXXXXX")"
PC_HOME="$PC_TEST_ROOT/home"
PC_CACHE="$PC_TEST_ROOT/npm-cache"
mkdir -p "$PC_HOME" "$PC_CACHE"
trap 'rm -rf "$PC_TEST_ROOT"' EXIT

export HOME="$PC_HOME"
export ANDRECOMP_HOME="$PC_HOME/.andrecomp"
export npm_config_cache="$PC_CACHE"
export npm_config_userconfig="$PC_HOME/.npmrc"
export PATH="$PC_HOME/.local/bin:$PATH"

if [ "$PC_INSTALL_DRIVER" = "published" ]; then
  (cd "$PC_TEST_ROOT" && npx --yes --registry https://registry.npmjs.org andrecomp install)
else
  (cd "$REPO_ROOT" && pnpm andrecomp install --yes)
fi

test -x "$PC_HOME/.local/bin/andrecomp"
test -L "$ANDRECOMP_HOME/cli/current"
test -f "$ANDRECOMP_HOME/cli/install.json"
andrecomp --version

mkdir -p "$ANDRECOMP_HOME/instances/default"
touch "$ANDRECOMP_HOME/instances/default/user-data-marker"
(cd "$REPO_ROOT" && pnpm andrecomp uninstall)

test ! -e "$ANDRECOMP_HOME/cli"
test ! -e "$PC_HOME/.local/bin/andrecomp"
test -f "$ANDRECOMP_HOME/instances/default/user-data-marker"
