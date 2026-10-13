---
title: CLI Overview
summary: CLI installation and setup
---

The Andrecomp CLI handles instance setup, diagnostics, and control-plane operations.

## Usage

```sh
pnpm andrecomp --help
```

## Global Options

All commands support:

| Flag | Description |
|------|-------------|
| `--data-dir <path>` | Local Andrecomp data root (isolates from `~/.andrecomp`) |
| `--api-base <url>` | API base URL |
| `--api-key <token>` | API authentication token |
| `--context <path>` | Context file path |
| `--profile <name>` | Context profile name |
| `--json` | Output as JSON |

Company-scoped commands also accept `--company-id <id>`.

For clean local instances, pass `--data-dir` on the command you run:

```sh
npx andrecomp run --data-dir ./tmp/andrecomp-dev
```

## Context Profiles

Store defaults to avoid repeating flags:

```sh
# Set defaults
npx andrecomp context set --api-base http://localhost:3100 --company-id <id>

# View current context
pnpm andrecomp context show

# List profiles
pnpm andrecomp context list

# Switch profile
npx andrecomp context use default
```

To avoid storing secrets in context, use an env var:

```sh
npx andrecomp context set --api-key-env-var-name ANDRECOMP_API_KEY
export ANDRECOMP_API_KEY=...
```

Secret operations are available under `andrecomp secrets`:

```sh
npx andrecomp secrets declarations --company-id <company-id> --kind secret
npx andrecomp secrets create --company-id <company-id> --name anthropic-api-key --value-env ANTHROPIC_API_KEY
npx andrecomp secrets link --company-id <company-id> --name prod-stripe-key --provider aws_secrets_manager --external-ref <provider-ref>
npx andrecomp secrets doctor --company-id <company-id>
npx andrecomp secrets migrate-inline-env --company-id <company-id> --apply
```

Context is stored at `~/.andrecomp/context.json`.

## Command Categories

The CLI has two categories:

1. **[Setup commands](/cli/setup-commands)** — instance bootstrap, diagnostics, configuration
2. **[Control-plane commands](/cli/control-plane-commands)** — issues, agents, approvals, activity
