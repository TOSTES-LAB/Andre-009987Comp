---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `andrecomp run`

One-command bootstrap and start:

```sh
pnpm andrecomp run
```

Does:

1. Auto-onboards if config is missing
2. Runs `andrecomp doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
npx andrecomp run --instance dev
```

## `andrecomp onboard`

Interactive first-time setup:

```sh
pnpm andrecomp onboard
```

If Andrecomp is already configured, rerunning `onboard` keeps the existing config in place. Use `andrecomp configure` to change settings on an existing install.

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm andrecomp onboard --run
```

Quickstart defaults + immediate start:

```sh
pnpm andrecomp onboard --yes
```

When onboarding starts Andrecomp from an interactive terminal, it opens the
onboarding page in your browser once. Non-interactive terminals stay silent.
Suppress browser opening explicitly for headless or automated runs with either
environment variable:

```sh
ANDRECOMP_NO_BROWSER=1 pnpm andrecomp onboard --yes
ANDRECOMP_OPEN_ON_LISTEN=false pnpm andrecomp onboard --yes
```

On an existing install, `--yes` now preserves the current config and just starts Andrecomp with that setup.

## `andrecomp doctor`

Health checks with optional auto-repair:

```sh
pnpm andrecomp doctor
pnpm andrecomp doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration, including AWS Secrets Manager non-secret env
  config when selected
- Storage configuration
- Missing key files

## `andrecomp configure`

Update configuration sections:

```sh
pnpm andrecomp configure --section server
pnpm andrecomp configure --section secrets
pnpm andrecomp configure --section storage
```

`--section secrets` updates the deployment-level provider used as the fallback
for secrets that do not target a specific company vault. Per-company provider
vaults (named instances, default vault selection, multiple vaults per provider,
coming-soon GCP/Vault) live in the board UI under
`Company Settings → Secrets → Provider vaults` and the
`/api/companies/{companyId}/secret-provider-configs` API.

## `andrecomp env`

Show resolved environment configuration:

```sh
pnpm andrecomp env
```

This now includes bind-oriented deployment settings such as `ANDRECOMP_BIND` and `ANDRECOMP_BIND_HOST` when configured.

## `andrecomp allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
npx andrecomp allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.andrecomp/instances/default/config.json` |
| Database | `~/.andrecomp/instances/default/db` |
| Logs | `~/.andrecomp/instances/default/logs` |
| Storage | `~/.andrecomp/instances/default/data/storage` |
| Secrets key | `~/.andrecomp/instances/default/secrets/master.key` |

Override with:

```sh
ANDRECOMP_HOME=/custom/home ANDRECOMP_INSTANCE_ID=dev pnpm andrecomp run
```

Or pass `--data-dir` directly on any command:

```sh
npx andrecomp run --data-dir ./tmp/andrecomp-dev
npx andrecomp doctor --data-dir ./tmp/andrecomp-dev
```
