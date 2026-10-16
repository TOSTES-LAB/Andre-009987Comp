# CLI Reference

Andrecomp CLI now supports both:

- installation and lifecycle management (`install`, `uninstall`, `update`, `upgrade`, `service`)
- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`, `env-lab`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Security: safe invocation for content-bearing arguments

Use `npx andrecomp` for any command whose argument can hold untrusted or
semi-trusted content. Untrusted content includes issue text, comment bodies,
Markdown, pasted snippets, and model output. `npx` runs the CLI binary directly.
It passes the argument as an inert `argv` value. It does not run a shell over the
value. `npx andrecomp` works on any machine with Node: it runs a local install
of the `andrecomp` package, and it fetches the published package when no local
install is present.

Do not use `pnpm andrecomp` for a content-bearing argument. `pnpm andrecomp`
is a `package.json` script. `pnpm` builds a `/bin/sh` command string and appends
the argument to it, so the shell reads the argument first. The shell interprets
these spans before the CLI starts:

- command substitution: a backtick pair or `$( )`
- variable expansion: `$NAME` or `${NAME}` (this can leak a secret value into the persisted argument)

A crafted value can run an arbitrary command as the invoking user. A crafted
value can also expand an environment variable into the stored argument. No
CLI-side check stops this, because the shell runs before `cli/src` starts. This
is true even when the argument comes from a quoted shell variable, because `pnpm`
re-evaluates the value in its own shell.

Safe forms:

- `npx andrecomp <command> <args>` — the documented default. It passes an inert
  `argv` value and runs on any machine.
- `node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts <command> <args>` —
  the safe form to run the local source from a monorepo checkout. It is the exact
  command that the `pnpm andrecomp` script wraps, but it runs directly, so no
  shell reads the argument. Use it when you must test your local `cli/src`
  changes with a content-bearing argument.

Unsafe or broken forms:

- `pnpm andrecomp <command> <args>` — unsafe. `pnpm` runs the argument through a
  shell first.
- `pnpm run <script> -- <args>`, or any `package.json` script that wraps the CLI —
  unsafe for the same reason.
- `pnpm exec andrecomp <command> <args>` — broken. The root workspace does not
  depend on the `andrecomp` package, so `pnpm` does not link its binary into
  `node_modules/.bin`. The command fails with `Command "andrecomp" not found`,
  even after a build. Do not use it.

Static placeholders only: a document must show a static placeholder such as
`<host>` in a command example, never a live `$( )` or `$NAME` span. The reader's
own shell expands such a span on paste, before any CLI or `npx` receives argv, so
a direct-exec form does not stop it.

`pnpm andrecomp` stays acceptable only for a fully literal local lifecycle or
setup command. A fully literal command carries no substitutable value. It has no
placeholder, no example value the reader replaces, no interpolation, no path, no
ref, no id, and no name. It holds the subcommand and, at most, flags that take no
value.

The allowlist of literal commands lives in one place:
`server/src/__tests__/cli-invocation-safety.test.ts`. A guard test enforces it
fail-closed. Any `pnpm andrecomp` line whose command string is not an exact
allowlist entry is an offender. The allowlist holds commands such as `run`,
`onboard`, `onboard --yes`, `doctor`, `configure --section <name>`, `connect`,
`env-lab up`, `env-lab down`, `context show`, `context list`,
`worktree ensure-seeded`, and `worktree env`.

Every invocation that carries a positional value or an option value uses
`npx andrecomp` instead. This covers a hostname (`allowed-hostname`), an import
URL or folder (`company import`), an identifier or secret (`--company-id`,
`--agent-id`, `--claim-secret`), a payload (`--payload-json`), free text
(`--body`, `--title`, `--comment`), a data directory (`--data-dir`), an instance
(`--instance`), a bind preset (`--bind`), a context-profile name, and every
worktree path, ref, id, or name option. A runtime value counts as non-fixed even
when it looks safe. The private-hostname guard builds `allowed-hostname <value>`
from the request Host header, so it uses `npx andrecomp`.

For a command that must run the local checked-out source with a value, use the
direct-exec form: `node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts
<command> <args>`.

The `pnpm --filter @andrecomp/*` build and test commands are not CLI
invocation. They do not change.

### Offline and air-gapped use

`npx andrecomp` runs offline when the `andrecomp` package is already in a
local install or in the npm cache. It reaches the network only when the package
is in neither place.

To force cache-only resolution and block any network attempt, run
`npx --offline andrecomp <command> <args>`. Use `npx --prefer-offline
andrecomp` when you accept a fetch only for a missing package.

To prepare an air-gapped host, install the package one time while the host is
online. Run `npm install -g andrecomp`, or run the documented `install.sh`
path. After that step, both `npx andrecomp` and the installed `andrecomp`
binary run offline. Both pass an inert `argv` value.

To move the package without a registry, run `npm pack andrecomp` on an online
host. Copy the tarball to the air-gapped host. Run `npm install -g
./andrecomp-<version>.tgz`.

Do not use `pnpm andrecomp` as an offline fallback for a content-bearing
argument. It runs the argument through a shell first, offline or online. It also
resolves only inside a monorepo checkout.

A monorepo contributor who works offline uses the direct-exec form that this
section documents above: `node cli/node_modules/tsx/dist/cli.mjs
cli/src/index.ts <command> <args>`. It passes an inert `argv` value and runs the
local source.

## Base Usage

Use repo script in development:

```sh
pnpm andrecomp --help
```

Recommended installation and interactive onboarding:

```sh
curl -fsSLO https://andrecomp.ing/install.sh
curl -fsSLO https://andrecomp.ing/install.sh.sha256
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c install.sh.sha256
else
  shasum -a 256 -c install.sh.sha256
fi
bash install.sh
```

The checksum detects transfer or publishing mistakes but is served from the
same origin as the installer. Use a release-tag or commit-pinned GitHub copy
when you need an independently hosted source. Piped installs require supported
Node.js, npm, and npx to already be installed; download the script first before
allowing it to bootstrap Node.js with privileged package-manager commands.

First-time local bootstrap from a source checkout:

```sh
pnpm andrecomp run
```

Choose local instance:

```sh
npx andrecomp run --instance dev
```

## Isolated Manual Test Drives

`andrecomp test-drive` creates or reuses an isolated local data directory,
ensures one usable CEO agent exists in a fresh database, starts Andrecomp in the
foreground, and opens the browser after initialization succeeds. It never
installs a background service and never creates a goal, project, issue, task,
or heartbeat.

```sh
npx andrecomp test-drive \
  [-d, --data-dir <path>] \
  [--company-name <name>] \
  [--agent-name <name>] \
  [--harness <claude|codex|opencode>] \
  [--model <model-id>] \
  [--api-key-env <variable> | --api-key <value>] \
  [--no-browser]
```

Defaults are `Test Company`, a `CEO` agent with the `ceo` role, and the Claude
harness. Without `--data-dir`, every invocation creates a unique OS temporary
directory and prints its absolute path. The directory is retained after exit
for inspection. An explicit data directory is reused and is never reset. The
reused directory must use Andrecomp's embedded database; `DATABASE_URL`,
`DATABASE_MIGRATION_URL`, and configs with `database.mode: postgres` are
rejected so test-drive cannot mutate an external database. The server also
ignores the invocation directory's `.env` for test-drive launches, while still
loading the selected instance's own environment file. Reused directories also
retain the normal guard against colliding with a managed Andrecomp service. The
server uses the first available loopback port at or above `3100`, so an
unrelated local Andrecomp process can remain running.

Harness configuration:

| Harness | Agent adapter | Agent credential variable | Model |
| --- | --- | --- | --- |
| `claude` | `claude_local` | `ANTHROPIC_API_KEY` | Optional; omitted uses the adapter default |
| `codex` | `codex_local` | `OPENAI_API_KEY` | Optional; omitted uses the adapter default |
| `opencode` | `opencode_local` | `OPENROUTER_API_KEY` | Required and must begin with `openrouter/` |

OpenCode model references retain their complete path, including additional
slashes:

```sh
OPENROUTER_API_KEY=... npx andrecomp test-drive \
  --harness opencode \
  --model openrouter/anthropic/claude-sonnet-4.5
```

Credentials come from `--api-key`, the variable named by `--api-key-env`, or
the harness's canonical environment variable shown in the table. `--api-key`
and `--api-key-env` are mutually exclusive. A custom source variable is still
stored and projected under the canonical target variable:

```sh
MY_ROUTER_KEY=... npx andrecomp test-drive \
  --harness opencode \
  --model openrouter/openai/gpt-5.4 \
  --api-key-env MY_ROUTER_KEY
```

Credentials are stored through Andrecomp's user-secret reference path and are
redacted from Andrecomp command output. Andrecomp does not print `--api-key`,
and it removes the value from its JavaScript argument view immediately after
Commander parses it. Andrecomp does not put the raw argument list in telemetry,
API metadata, or diagnostics. Command wrappers, operating-system process
listings, and shell history can still expose values passed in arguments. This
is an explicit tradeoff for the local test-drive workflow. Prefer an exported
canonical variable or `--api-key-env` when that matters. Provider connectivity,
local harness installation, credential validity, and model availability are
intentionally checked only when the agent first runs.

When invoked inside a linked Git worktree, the command ignores inherited
`ANDRECOMP_IN_WORKTREE` state, launches in worktree mode, and verifies **Run
tasks in this worktree** is armed for the current instance before opening the
browser. In a primary checkout or non-Git directory it launches without
worktree mode and does not alter the setting. On reuse, if any company already
exists, all bootstrap flags are ignored and companies, agents, and secrets are
left untouched; worktree-setting reconciliation is the only permitted
mutation.

Use `--no-browser` for a foreground instance that prints its ready URL without
opening it.

## Install, Update, And Uninstall

Managed installs keep CLI payloads under `~/.andrecomp/cli`, expose a stable
`~/.local/bin/andrecomp` shim, switch versions atomically, and retain two
previous payloads for rollback.

```sh
andrecomp install
andrecomp install --canary
andrecomp install --version <version>
andrecomp install --ref <branch|tag|sha> [--repo owner/repo]
andrecomp update
andrecomp update --latest|--canary|--version <version>
andrecomp update --rollback
andrecomp upgrade
andrecomp uninstall
```

`upgrade` aliases `update`. `uninstall` removes managed code and the shim but
preserves instance data under `~/.andrecomp/instances/`. See
`doc/INSTALLING.md` for installation methods, security notes, PATH setup, and
the complete update and rollback behavior.

## Onboarding And Service Management

Interactive onboarding offers to install a background service on supported
platforms. `--yes` never installs it implicitly; automation must opt in.

```sh
andrecomp onboard
andrecomp onboard --yes
andrecomp onboard --yes --install-service
andrecomp onboard --yes --no-install-service
```

Service lifecycle commands remain under the `service` namespace:

```sh
andrecomp service install [--no-start-now] [--no-start-on-login]
andrecomp service uninstall
andrecomp service start
andrecomp service stop
andrecomp service restart [--wait]
andrecomp service status [--json]
andrecomp service logs [-f]
```

Every service verb supports `--instance <id>` and `--json`. Linux and WSL2 use
a systemd user unit when available; macOS uses a LaunchAgent. Unsupported
environments receive foreground `andrecomp run` guidance.

`andrecomp doctor` includes managed-install and service-health diagnostics in
addition to configuration, storage, database, logging, and port checks.

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `andrecomp onboard` and `andrecomp configure --section server` set deployment mode in config
- server onboarding/configure ask for reachability intent and write `server.bind`
- `andrecomp run --bind <loopback|lan|tailnet>` passes a quickstart bind preset into first-run onboarding when config is missing
- runtime can override mode with `ANDRECOMP_DEPLOYMENT_MODE`
- `andrecomp run` and `andrecomp doctor` still do not expose a direct low-level `--mode` flag

Canonical behavior is documented in `doc/DEPLOYMENT-MODES.md`.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
npx andrecomp allowed-hostname dotta-macbook-pro
```

Bring up the default local SSH fixture for environment testing:

```sh
pnpm andrecomp env-lab up
pnpm andrecomp env-lab doctor
pnpm andrecomp env-lab status --json
pnpm andrecomp env-lab down
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

API base resolution order:

1. `--api-base <url>`
2. `ANDRECOMP_API_URL`
3. selected context profile `apiBase`
4. local Andrecomp config server port
5. `http://localhost:3100`

Connection failures include the attempted URL and a `GET /api/health` check hint.

## Connect Wizard

```sh
pnpm andrecomp connect
```

`connect` confirms the resolved API base, verifies `GET /api/health`, authenticates board access when needed, and saves a persona-aware profile:

- `persona=board` for board operator profiles
- `persona=agent` with `agentId` and `agentName` for agent profiles

Profiles store token env-var names, not plaintext tokens. The wizard prints shell exports for the newly created token.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.andrecomp`:

```sh
npx andrecomp run --data-dir ./tmp/andrecomp-dev
npx andrecomp issue list --data-dir ./tmp/andrecomp-dev
```

## Context Profiles

Store local defaults in `~/.andrecomp/context.json`:

```sh
npx andrecomp context set --api-base http://localhost:3100 --company-id <company-id>
npx andrecomp context set --persona agent --agent-id <agent-id> --api-key-env-var-name ANDRECOMP_API_KEY
pnpm andrecomp context show
pnpm andrecomp context list
npx andrecomp context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
npx andrecomp context set --api-key-env-var-name ANDRECOMP_API_KEY
export ANDRECOMP_API_KEY=...
```

## Organization Commands

```sh
npx andrecomp company list
npx andrecomp company get <company-id>
npx andrecomp company current [--company-id <company-id>]
npx andrecomp company stats
npx andrecomp company create --payload-json '{...}'
npx andrecomp company update <company-id> --payload-json '{...}'
npx andrecomp company branding:update <company-id> --payload-json '{...}'
npx andrecomp company archive <company-id>
npx andrecomp company export <company-id> --out ./company --include company,agents,projects,issues,skills
npx andrecomp company export:preview <company-id> --payload-json '{...}'
npx andrecomp company export:api <company-id> --payload-json '{...}'
npx andrecomp company import ./company --target new --new-company-name "Imported Company"
npx andrecomp company import:preview <company-id> --payload-json '{...}'
npx andrecomp company import:apply <company-id> --payload-json '{...}'
npx andrecomp company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
npx andrecomp company delete PAP --yes --confirm PAP
npx andrecomp company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- With agent authentication, `company list` and `company current` are
  agent-safe company selectors. `company list` first tries the board-wide list;
  if that is forbidden, it uses `--company-id`, `ANDRECOMP_COMPANY_ID`, context,
  or `/api/agents/me` and then reads only that scoped company.
- `company create` requires board/instance-admin authentication because it is
  an instance-wide setup command.
- Deletion is server-gated by `ANDRECOMP_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `ANDRECOMP_COMPANY_ID`), not another company.

## Issue Commands

```sh
npx andrecomp issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
npx andrecomp issue get <issue-id-or-identifier>
npx andrecomp issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high] [--parent-id <issue-id> | --standalone]
npx andrecomp issue update <issue-id> [--status in_progress] [--comment "..."]
npx andrecomp issue delete <issue-id> --yes
npx andrecomp issue comment <issue-id> --body "..." [--attachment-id <id...>] [--reopen]
npx andrecomp issue comments <issue-id> [--limit 50]
npx andrecomp issue comment:get <issue-id> <comment-id>
npx andrecomp issue comment:delete <issue-id> <comment-id>
npx andrecomp issue runs <issue-id-or-identifier>
npx andrecomp issue live-runs <issue-id-or-identifier>
npx andrecomp issue active-run <issue-id-or-identifier>
npx andrecomp issue heartbeat-context <issue-id>
npx andrecomp issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
npx andrecomp issue release <issue-id>
npx andrecomp issue force-release <issue-id>
```

`issue create` sent from an agent run bound to an ordinary execution task is parented under that task when `--parent-id` is omitted; pass `--standalone` to create intentionally top-level work (`parentId: null`). The two flags are mutually exclusive.

Issue subresources are exposed as Andrecomp API wrappers. Commands that map to broad server schemas accept JSON payloads and validate them with shared schemas before sending.

```sh
npx andrecomp issue child:create <issue-id> --payload-json '{"title":"Child task"}'
npx andrecomp issue approvals <issue-id>
npx andrecomp issue approval:link <issue-id> <approval-id>
npx andrecomp issue approval:unlink <issue-id> <approval-id>
npx andrecomp issue read <issue-id>
npx andrecomp issue unread <issue-id>
npx andrecomp issue archive <issue-id>
npx andrecomp issue unarchive <issue-id>
npx andrecomp issue recovery-actions <issue-id>
npx andrecomp issue recovery:resolve <issue-id> --outcome restored --source-issue-status todo
```

```sh
npx andrecomp issue documents <issue-id> [--include-system]
npx andrecomp issue document:get <issue-id> <key>
npx andrecomp issue document:put <issue-id> <key> --body-file ./plan.md [--title Plan]
npx andrecomp issue document:lock <issue-id> <key>
npx andrecomp issue document:unlock <issue-id> <key>
npx andrecomp issue document:revisions <issue-id> <key>
npx andrecomp issue document:restore <issue-id> <key> <revision-id>
npx andrecomp issue document:delete <issue-id> <key>
```

```sh
npx andrecomp issue work-products <issue-id>
npx andrecomp issue work-product:create <issue-id> --payload-json '{"type":"pull_request","provider":"github","title":"PR"}'
npx andrecomp issue work-product:update <work-product-id> --payload-json '{"status":"archived"}'
npx andrecomp issue work-product:delete <work-product-id>
npx andrecomp issue interactions <issue-id>
npx andrecomp issue interaction:create <issue-id> --payload-json '{"kind":"request_confirmation","payload":{"version":1,"prompt":"Continue?"}}'
npx andrecomp issue interaction:accept <issue-id> <interaction-id> [--selected-client-keys key1,key2]
npx andrecomp issue interaction:reject <issue-id> <interaction-id> [--reason "..."]
npx andrecomp issue interaction:respond <issue-id> <interaction-id> --answers-json '[{"questionId":"q1","optionIds":["yes"]}]'
npx andrecomp issue interaction:cancel <issue-id> <interaction-id> [--reason "..."]
```

```sh
npx andrecomp issue tree-state <issue-id>
npx andrecomp issue tree-preview <issue-id> --payload-json '{"mode":"pause"}'
npx andrecomp issue tree-holds <issue-id> [--status active] [--include-members]
npx andrecomp issue tree-hold:create <issue-id> --payload-json '{"mode":"pause","reason":"review"}'
npx andrecomp issue tree-hold:get <issue-id> <hold-id>
npx andrecomp issue tree-hold:release <issue-id> <hold-id> [--payload-json '{"reason":"done"}']
npx andrecomp issue attachments <issue-id>
npx andrecomp issue attachment:upload <issue-id> --company-id <company-id> --file ./artifact.txt
npx andrecomp issue attachment:download <attachment-id> [--out ./artifact.txt]
npx andrecomp issue attachment:delete <attachment-id>
npx andrecomp issue label:list --company-id <company-id>
npx andrecomp issue label:create --company-id <company-id> --name bug --color '#ff0000'
npx andrecomp issue label:delete <label-id>
npx andrecomp issue feedback:votes <issue-id>
npx andrecomp issue feedback:vote <issue-id> --payload-json '{"targetType":"issue_comment","targetId":"...","vote":"up"}'
```

## Project Commands

```sh
npx andrecomp project list --company-id <company-id>
npx andrecomp project get <project-id-or-shortname> [--company-id <company-id>]
npx andrecomp project create --company-id <company-id> --name "Launch Site" [--goal-ids <id1,id2>] [--lead-agent-id <id>]
npx andrecomp project update <project-id-or-shortname> [--status in_progress] [--company-id <company-id>]
npx andrecomp project delete <project-id-or-shortname> --yes [--company-id <company-id>]
```

Advanced project fields accept JSON:

```sh
npx andrecomp project create --company-id <company-id> --name "Ops" --env-json '{"OPENAI_API_KEY":{"kind":"secret","secretName":"openai-api-key"}}'
npx andrecomp project update <project-id> --execution-workspace-policy-json '{"enabled":true,"defaultMode":"shared_workspace"}'
```

## Goal Commands

```sh
npx andrecomp goal list --company-id <company-id>
npx andrecomp goal get <goal-id>
npx andrecomp goal create --company-id <company-id> --title "Grow revenue" [--level company] [--status active]
npx andrecomp goal update <goal-id> [--title "..."] [--status achieved]
npx andrecomp goal delete <goal-id> --yes
```

## Agent Commands

```sh
npx andrecomp agent list --company-id <company-id>
npx andrecomp agent get <agent-id>
npx andrecomp agent create --company-id <company-id> --payload-json '{"name":"Builder","adapterType":"codex_local"}'
npx andrecomp agent hire --company-id <company-id> --payload-json '{...}'
npx andrecomp agent update <agent-id> --payload-json '{"title":"Senior Builder"}'
npx andrecomp agent delete <agent-id> --yes
npx andrecomp agent me
npx andrecomp agent inbox
npx andrecomp agent inbox-mine --user-id <board-user-id>
npx andrecomp agent wake <agent-id-or-shortname> [--company-id <company-id>] [--reason "..."] [--payload '{"issueId":"..."}']
npx andrecomp agent pause <agent-id>
npx andrecomp agent resume <agent-id>
npx andrecomp agent approve <agent-id>
npx andrecomp agent terminate <agent-id>
npx andrecomp agent heartbeat:invoke <agent-id>
npx andrecomp agent claude-login <agent-id>
npx andrecomp agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

Agent configuration and runtime endpoints:

```sh
npx andrecomp agent permissions:update <agent-id> --payload-json '{"canCreateAgents":true,"canCreateSkills":true,"canAssignTasks":true}'
npx andrecomp agent configuration <agent-id>
npx andrecomp agent config-revisions <agent-id>
npx andrecomp agent config-revision:get <agent-id> <revision-id>
npx andrecomp agent config-revision:rollback <agent-id> <revision-id>
npx andrecomp agent runtime-state <agent-id>
npx andrecomp agent runtime-state:reset-session <agent-id> [--task-key <key>]
npx andrecomp agent task-sessions <agent-id>
npx andrecomp agent skills <agent-id>
npx andrecomp agent skills:sync <agent-id> --desired-skills andrecomp,github --mode add
npx andrecomp agent instructions-path:update <agent-id> --payload-json '{"path":"/path/to/AGENTS.md"}'
npx andrecomp agent instructions-bundle <agent-id>
npx andrecomp agent instructions-bundle:update <agent-id> --payload-json '{"mode":"managed"}'
npx andrecomp agent instructions-file:get <agent-id> --path AGENTS.md
npx andrecomp agent instructions-file:put <agent-id> --path AGENTS.md --content-file ./AGENTS.md
npx andrecomp agent instructions-file:delete <agent-id> --path AGENTS.md --yes
```

Agent config, instructions, skills, project env, environment, secret, and workspace edits affect the next run. Active runs finish with the config they started with. When a saved session, reused workspace, or sandbox lease no longer matches the effective next-run config, Andrecomp may start fresh execution and records non-sensitive freshness categories in run result JSON and workspace operation logs.

`agent local-cli` is the quickest way to run local Claude/Codex manually as a Andrecomp agent:

- creates a new long-lived agent API key
- installs missing Andrecomp skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `ANDRECOMP_API_URL`, `ANDRECOMP_COMPANY_ID`, `ANDRECOMP_AGENT_ID`, and `ANDRECOMP_API_KEY`

Example for shortname-based local setup:

```sh
npx andrecomp agent local-cli codexcoder --company-id <company-id>
npx andrecomp agent local-cli claudecoder --company-id <company-id>
```

## Token Commands

Agent API keys are scoped to one company and one agent. Plaintext tokens are printed once at creation.

```sh
npx andrecomp token agent create --company-id <company-id> --agent <agent-id-or-name> --name external-worker
npx andrecomp token agent list --company-id <company-id> --agent <agent-id-or-name>
npx andrecomp token agent revoke --company-id <company-id> --agent <agent-id-or-name> <key-id>
```

Named board API keys use the board authorization model, support revocation and expiration metadata, and are audited server-side.

```sh
npx andrecomp token board create --company-id <company-id> --name external-admin
npx andrecomp token board create --name short-lived --ttl-days 7
npx andrecomp token board list
npx andrecomp token board revoke <key-id>
```

## Run Commands

`andrecomp run` without a subcommand still bootstraps and starts a local Andrecomp instance. The subcommands below inspect and control API heartbeat runs.

```sh
npx andrecomp run list --company-id <company-id> [--agent-id <agent-id>] [--limit 50]
npx andrecomp run live --company-id <company-id> [--limit 50] [--min-count 0]
npx andrecomp run get <run-id>
npx andrecomp run events <run-id> [--after-seq 0] [--limit 200]
npx andrecomp run log <run-id> [--offset 0] [--limit-bytes 16384] [--text]
npx andrecomp run cancel <run-id>
npx andrecomp run issues <run-id>
npx andrecomp run workspace-operations <run-id>
npx andrecomp run workspace-log <operation-id> [--offset 0] [--limit-bytes 16384] [--text]
npx andrecomp run watchdog-decision <run-id> --decision continue [--reason "..."]
```

## Routine Commands

`andrecomp routines disable-all` remains the local maintenance command. The singular `routine` group maps to the REST API.

```sh
npx andrecomp routine list --company-id <company-id> [--project-id <project-id>]
npx andrecomp routine create --company-id <company-id> --payload-json '{...}'
npx andrecomp routine get <routine-id>
npx andrecomp routine update <routine-id> --payload-json '{...}'
npx andrecomp routine revisions <routine-id>
npx andrecomp routine revision:restore <routine-id> <revision-id>
npx andrecomp routine runs <routine-id> [--limit 50]
npx andrecomp routine run <routine-id> [--payload-json '{...}']
npx andrecomp routine trigger:create <routine-id> --payload-json '{...}'
npx andrecomp routine trigger:update <trigger-id> --payload-json '{...}'
npx andrecomp routine trigger:delete <trigger-id>
npx andrecomp routine trigger:rotate-secret <trigger-id>
npx andrecomp routine trigger:fire <public-id> [--payload-json '{...}']
```

## Prompt Handoff

Prompt handoff creates Andrecomp work. It does not create a chat session.

```sh
npx andrecomp agent-prompt <agent-name-or-id> <agent-api-key> "Prompt here"
npx andrecomp agent prompt --agent <agent-name-or-id> --api-key-env ANDRECOMP_API_KEY "Prompt here"
npx andrecomp agent prompt --profile my-agent "Prompt here"
npx andrecomp board prompt --company-id <company-id> --agent <agent-name-or-id> "Prompt here"
```

By default the command creates a `todo` issue assigned to the target agent and wakes the agent. Use `--issue <issue-id>` to add a comment to existing work, and `--no-wake` to skip the wakeup.

## Skills Commands

`andrecomp skills` covers three distinct operations:

1. **Company install** — adds or updates a row in `company_skills` for the
   whole company. This is what `skills install`, `skills import`, `skills create`,
   and `skills scan-projects` do.
2. **Agent attach** — merges an agent's *desired* company skill set with an
   explicit `add`, `remove`, or `replace` mode (`skills agent sync`/`clear`).
   This is a desired-state operation on the agent's adapter config; it does not
   change the company library.
3. **Adapter runtime sync** — the adapter reconciles the desired skill set
   with files on disk and reports an `AgentSkillSnapshot` (`skills agent list`).
   `skills agent sync` triggers this automatically after updating desired state.

Required Andrecomp runtime skills (heartbeat, etc.) remain server-enforced and
are added on top of whatever the desired set names.

Company skill mutations (`skills install`, `skills import`, `skills create`, and
`skills scan-projects`) are open to same-company actors by default. Missing
`skills:create` grants and `canCreateSkills` settings do not deny these commands;
only an explicit company skill policy restriction does. Core safety and company
boundary checks still apply, and `agents:create` remains required when a command
also creates agents.

### Catalog (app-shipped skills)

The Andrecomp app ships a curated catalog under `@andrecomp/skills-catalog`.
Browse and inspect commands never mutate company state; `install` adds a catalog
skill to the company library.

```sh
npx andrecomp skills browse [--kind bundled|optional] [--category <slug>] [--query <text>]
npx andrecomp skills search "<text>" [--kind bundled|optional] [--category <slug>]
npx andrecomp skills inspect <catalog-id-or-key-or-slug>
npx andrecomp skills install <catalog-id-or-key-or-slug> [--as <slug>] [--force] --company-id <company-id>
```

Catalog semantics:

- **Bundled** skills live in `packages/skills-catalog/catalog/bundled/<category>/<slug>`
  and are recommended defaults for most companies. They use canonical key
  `andrecomp/bundled/<category>/<slug>`.
- **Optional** skills live in `packages/skills-catalog/catalog/optional/<category>/<slug>`
  and are role-specific or domain-specific (browser, AWS ops, etc.). Same key
  shape with `optional` in place of `bundled`.
- `skills install` materializes the catalog files into a company-managed skill
  directory and records provenance (`catalogId`, `catalogKey`, `packageVersion`,
  `originHash`, …) so future updates and audit decisions stay consistent.
- `--as <slug>` overrides the company skill slug. `--force` may replace a
  same-key catalog-managed skill but never bypasses hard validation or hard-stop
  audit findings.

Examples:

```sh
npx andrecomp skills browse --kind bundled --company-id <company-id>
npx andrecomp skills search "pull request" --kind bundled
npx andrecomp skills inspect github-pr-workflow
npx andrecomp skills install github-pr-workflow --company-id <company-id>
npx andrecomp skills install andrecomp:optional:browser:agent-browser --company-id <company-id>
```

External GitHub, skills.sh, local-path, and URL sources still go through
`skills import`; catalog commands are for the app-shipped catalog only.

### Organization library

```sh
npx andrecomp skills list --company-id <company-id>
npx andrecomp skills show <skill-id-or-key-or-slug> --company-id <company-id>
npx andrecomp skills file <skill-id-or-key-or-slug> [--path SKILL.md] --company-id <company-id>
npx andrecomp skills import <source> --company-id <company-id>
npx andrecomp skills create --name "Review PRs" [--slug review-prs] [--description "..."] [--body-file SKILL.md] --company-id <company-id>
npx andrecomp skills scan-projects [--project-id <id>...] [--workspace-id <id>...] --company-id <company-id>
npx andrecomp skills check [skill-id-or-key-or-slug] --company-id <company-id>
npx andrecomp skills update <skill-id-or-key-or-slug> [--force] --company-id <company-id>
npx andrecomp skills update --all [--force] --company-id <company-id>
npx andrecomp skills audit [skill-id-or-key-or-slug] --company-id <company-id>
npx andrecomp skills reset <skill-id-or-key-or-slug> [--yes] [--force] --company-id <company-id>
npx andrecomp skills remove <skill-id-or-key-or-slug> --yes --company-id <company-id>
```

`skills import <source>` accepts a skills.sh URL, the equivalent
`<owner>/<repo>/<skill>` shorthand, a GitHub URL, a local path, or an
`npx skills add …` command. See `references/company-skills.md` in the agent
skill bundle for the source-type table.

`skills check`, `skills update`, `skills audit`, and `skills reset` are the
maintenance loop for catalog-installed skills:

- `check` reports whether each skill's installed bytes match its pinned origin
  (`hasUpdate`, `installedHash`, `originHash`, `updateHoldReason`,
  `auditVerdict`).
- `update` installs the pinned update through the existing install-update API.
  `--all` checks every company skill and updates only those with
  `hasUpdate=true`. `--force` discards local-modification or soft-audit holds;
  hard-stop audit findings still block the update.
- `audit` re-scans installed bytes and reports findings without executing
  anything.
- `reset` reinstalls a catalog-managed skill from its pinned origin, discarding
  local edits. Prompts in a TTY; requires `--yes` for non-interactive use.

### Agent attach

```sh
npx andrecomp skills agent list <agent-id-or-shortname> --company-id <company-id>
npx andrecomp skills agent sync <agent-id-or-shortname> --skill <skill-id-or-key-or-slug> [--skill <skill-id-or-key-or-slug>...] --mode <add|remove|replace> --company-id <company-id>
npx andrecomp skills agent clear <agent-id-or-shortname> --yes --company-id <company-id>
```

`skills agent sync` requires a merge mode and returns the resulting adapter
`AgentSkillSnapshot`. `add` preserves all unnamed assignments, `remove` deletes
only named assignments, and `replace` destructively overwrites the complete
non-required desired skill set.
`skills agent clear` sends an empty desired list. Required Andrecomp skills are
still enforced by the server in both cases.

### Notes

- Skill references accept company skill `id`, canonical `key`, or unique
  `slug`; catalog references accept catalog `id`, `key`, or unique `slug`.
- `skills file` prints raw file content in human mode so it can be piped.
- `skills create --body-file -` reads the skill markdown body from stdin.
- `skills remove`, `skills reset`, and `skills agent clear` prompt in a TTY and
  require `--yes` in non-interactive use.
- `--json` prints the raw API result for each command.

## Teams Commands

`andrecomp teams` works with the app-shipped team catalog in
`@andrecomp/teams-catalog`. Browse, search, inspect, and file reads do not
change company state. `preview` runs the company import planner, and `install`
imports the catalog team into an existing company.

```sh
npx andrecomp teams browse [--kind bundled|optional] [--category <slug>] [--query <text>]
npx andrecomp teams search "<text>" [--kind bundled|optional] [--category <slug>]
npx andrecomp teams inspect <catalog-id-or-key-or-slug> [--file TEAM.md]
npx andrecomp teams preview <catalog-id-or-key-or-slug> --company-id <company-id>
npx andrecomp teams install <catalog-id-or-key-or-slug> --company-id <company-id>
```

Preview/install options:

- Under agent authentication, use `andrecomp company list --json`,
  `andrecomp company current --json`, or `ANDRECOMP_COMPANY_ID` to select the
  target company. `company list` falls back to the scoped current company when
  board-wide listing is forbidden. `teams install` creates agents and therefore
  requires board authentication, an `agents:create` grant, or an agent with the
  `canCreateAgents` permission (enabled by default for newly created
  standard-trust agents; low-trust agents and pre-existing agents without an
  explicit value stay disabled).
- `--request-approval-on-forbidden` turns a 403 install denial into a linked
  board approval request instead of a raw failed command; use
  `--approval-issue-id <id>` to attach it to a specific issue. During Andrecomp
  task runs with `ANDRECOMP_TASK_ID` set, this fallback is automatic so
  agent-run walkthroughs leave a pending approval path instead of a raw 403.
- `--target-manager-agent-id <id>` or `--target-manager-slug <slug>` reparents
  catalog root agents under an existing manager.
- `--agent <slug>` and `--selected-file <path>` narrow the import.
- `--collision-strategy rename|skip|replace` controls name/key collisions.
- `--allow-external-sources`, `--allow-unpinned-optional-sources`, and
  `--allow-local-path-sources` explicitly opt into higher-trust source policy.
  Local-path sources are development-only and stay blocked unless that flag is
  passed.

## Secrets Commands

```sh
npx andrecomp secrets list --company-id <company-id>
npx andrecomp secrets declarations --company-id <company-id> [--include agents,projects] [--kind secret]
npx andrecomp secrets create --company-id <company-id> --name anthropic-api-key --value-env ANTHROPIC_API_KEY
npx andrecomp secrets link --company-id <company-id> --name prod-stripe-key --provider aws_secrets_manager --external-ref <provider-ref>
npx andrecomp secrets doctor --company-id <company-id>
npx andrecomp secrets provider-configs --company-id <company-id>
npx andrecomp secrets provider-config:create --company-id <company-id> --payload-json '{...}'
npx andrecomp secrets provider-config:discovery-preview --company-id <company-id> --payload-json '{...}'
npx andrecomp secrets provider-config:get <config-id>
npx andrecomp secrets provider-config:update <config-id> --payload-json '{...}'
npx andrecomp secrets provider-config:default <config-id>
npx andrecomp secrets provider-config:health <config-id>
npx andrecomp secrets provider-config:delete <config-id>
npx andrecomp secrets remote-import:preview --company-id <company-id> --payload-json '{...}'
npx andrecomp secrets remote-import --company-id <company-id> --payload-json '{...}'
npx andrecomp secrets migrate-inline-env --company-id <company-id> [--apply]
```

Secret listing and declarations never print secret values. `create` accepts
`--value-env` so shell history does not capture the value. `link` records
provider-owned references without copying the secret value into Andrecomp.
For AWS-backed secrets, `secrets doctor` reports missing non-secret provider
env and the expected AWS SDK runtime credential source; do not store AWS
bootstrap credentials in Andrecomp secrets.

Per-company provider vaults (multiple vault instances per provider, default
vault selection, coming-soon GCP/Vault) can be configured from the board UI under
`Organization Settings → Secrets → Provider vaults` or through the provider-config CLI
commands above. See the
[secrets deploy guide](../docs/deploy/secrets.md#provider-vaults) and
[API reference](../docs/api/secrets.md#provider-vaults) for the contract.

## Approval Commands

```sh
npx andrecomp approval list --company-id <company-id> [--status pending]
npx andrecomp approval get <approval-id>
npx andrecomp approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
npx andrecomp approval approve <approval-id> [--decision-note "..."]
npx andrecomp approval reject <approval-id> [--decision-note "..."]
npx andrecomp approval request-revision <approval-id> [--decision-note "..."]
npx andrecomp approval resubmit <approval-id> [--payload '{"...":"..."}']
npx andrecomp approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
npx andrecomp activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
npx andrecomp activity create --company-id <company-id> --payload-json '{...}'
npx andrecomp activity issue <issue-id>
```

## Dashboard Commands

```sh
npx andrecomp dashboard get --company-id <company-id>
```

## Org And Agent Config Commands

```sh
npx andrecomp whoami
npx andrecomp openapi
npx andrecomp org get --company-id <company-id>
npx andrecomp org svg --company-id <company-id> [--out org.svg]
npx andrecomp org png --company-id <company-id> [--out org.png]
npx andrecomp agent-config list --company-id <company-id>
```

## Access, Profile, And Instance Commands

```sh
npx andrecomp profile session
npx andrecomp profile get
npx andrecomp profile update --payload-json '{...}'
npx andrecomp profile company-user <user-slug> --company-id <company-id>
npx andrecomp invite list --company-id <company-id>
npx andrecomp invite create --company-id <company-id> --payload-json '{...}'
npx andrecomp invite revoke <invite-id>
npx andrecomp invite show <token>
npx andrecomp invite accept <token> [--payload-json '{...}']
npx andrecomp invite onboarding:text <token>
npx andrecomp join list --company-id <company-id> [--status pending_approval]
npx andrecomp join approve <request-id> --company-id <company-id>
npx andrecomp join reject <request-id> --company-id <company-id>
npx andrecomp join claim-key <request-id> --claim-secret <secret>
npx andrecomp member list --company-id <company-id>
npx andrecomp member update <member-id> --company-id <company-id> --payload-json '{...}'
npx andrecomp member role-and-grants <member-id> --company-id <company-id> --payload-json '{...}'
npx andrecomp member permissions <member-id> --company-id <company-id> --payload-json '{...}'
npx andrecomp member archive <member-id> --company-id <company-id> [--payload-json '{...}']
npx andrecomp admin user list [--query <text>]
npx andrecomp admin user promote <user-id>
npx andrecomp admin user demote <user-id>
npx andrecomp admin user company-access <user-id>
npx andrecomp admin user company-access:update <user-id> --payload-json '{...}'
```

CLI auth challenge endpoints are also exposed for tooling that needs the raw challenge lifecycle:

```sh
npx andrecomp auth challenge create --payload-json '{...}'
ANDRECOMP_CHALLENGE_SECRET=<challenge-secret> npx andrecomp auth challenge get <challenge-id> --token-env ANDRECOMP_CHALLENGE_SECRET
ANDRECOMP_CHALLENGE_SECRET=<challenge-secret> npx andrecomp auth challenge approve <challenge-id> --token-env ANDRECOMP_CHALLENGE_SECRET
ANDRECOMP_CHALLENGE_SECRET=<challenge-secret> npx andrecomp auth challenge cancel <challenge-id> --token-env ANDRECOMP_CHALLENGE_SECRET
npx andrecomp auth revoke-current
```

`--token <challenge-secret>` is still supported for compatibility, but `--token-env` avoids putting challenge secrets in shell history or process arguments.

Use the challenge UUID returned by `auth challenge create` for get, approve, and
cancel. With the required secret and approval authentication present, malformed
IDs return HTTP 400 before database access. A status request without a secret
returns HTTP 404. Unknown challenges or incorrect challenge secrets still return
HTTP 404. Approval requires board authentication, checked before ID validation.

## Instance Settings Commands

```sh
npx andrecomp instance scheduler-heartbeats
npx andrecomp instance settings:general
npx andrecomp instance settings:general:update --payload-json '{...}'
npx andrecomp instance settings:experimental
npx andrecomp instance settings:experimental:update --payload-json '{...}'
npx andrecomp instance database-backup
```

Experimental features are opt-in and are provided without compatibility guarantees. They may break, change, or be removed at any time. Use them at your own risk.

```sh
npx andrecomp sidebar preferences
npx andrecomp sidebar preferences:update --payload-json '{...}'
npx andrecomp sidebar project-preferences --company-id <company-id>
npx andrecomp sidebar project-preferences:update --company-id <company-id> --payload-json '{...}'
npx andrecomp sidebar badges --company-id <company-id>
npx andrecomp inbox dismissals --company-id <company-id>
npx andrecomp inbox dismiss --company-id <company-id> --payload-json '{"itemKey":"run:<run-id>"}'
npx andrecomp board-claim show <token>
npx andrecomp board-claim claim <token> [--payload-json '{...}']
npx andrecomp openclaw invite-prompt --company-id <company-id> --payload-json '{...}'
npx andrecomp available-skill list
npx andrecomp available-skill index
npx andrecomp available-skill get <skill-name>
npx andrecomp llm agent-configuration
npx andrecomp llm agent-configuration:adapter <adapter-type>
npx andrecomp llm agent-icons
```

Hermes gateway uses the generic invite/join commands above rather than
`openclaw invite-prompt`. Create an agent invite, read
`invite onboarding:text`, submit a join request with
`adapterType: "hermes_gateway"` and `agentDefaultsPayload.apiBaseUrl` /
`agentDefaultsPayload.apiKey`, then approve and claim the key with the `join`
commands. See [HERMES_GATEWAY_ONBOARDING.md](./HERMES_GATEWAY_ONBOARDING.md).

## Adapter, Asset, And Skill Commands

```sh
npx andrecomp adapter list
npx andrecomp adapter install --payload-json '{"packageName":"@scope/adapter","version":"1.2.3"}'
npx andrecomp adapter get <adapter-type>
npx andrecomp adapter update <adapter-type> --payload-json '{"disabled":true}'
npx andrecomp adapter override <adapter-type> --payload-json '{"paused":true}'
npx andrecomp adapter reload <adapter-type>
npx andrecomp adapter reinstall <adapter-type>
npx andrecomp adapter delete <adapter-type>
npx andrecomp adapter config-schema <adapter-type>
npx andrecomp adapter ui-parser <adapter-type>
npx andrecomp adapter models <adapter-type> --company-id <company-id> [--refresh] [--environment-id <id>]
npx andrecomp adapter detect-model <adapter-type> --company-id <company-id>
npx andrecomp adapter test-environment <adapter-type> --company-id <company-id> --payload-json '{...}'
```

```sh
npx andrecomp asset image:upload --company-id <company-id> --file ./image.png [--namespace docs] [--alt "..."]
npx andrecomp asset logo:upload --company-id <company-id> --file ./logo.svg
npx andrecomp asset content <asset-id> --out ./asset.bin
```

```sh
npx andrecomp skill list --company-id <company-id>
npx andrecomp skill get <skill-id> --company-id <company-id>
npx andrecomp skill file <skill-id> --company-id <company-id> [--path SKILL.md]
npx andrecomp skill create --company-id <company-id> --payload-json '{...}'
npx andrecomp skill file:update <skill-id> --company-id <company-id> --payload-json '{...}'
npx andrecomp skill import --company-id <company-id> --payload-json '{"source":"github:owner/repo/path"}'
npx andrecomp skill scan-projects --company-id <company-id> --payload-json '{...}'
npx andrecomp skill update-status <skill-id> --company-id <company-id>
npx andrecomp skill install-update <skill-id> --company-id <company-id>
npx andrecomp skill delete <skill-id> --company-id <company-id>
```

## Cost, Finance, And Budget Commands

```sh
npx andrecomp cost summary --company-id <company-id>
npx andrecomp cost by-agent --company-id <company-id>
npx andrecomp cost by-agent-model --company-id <company-id>
npx andrecomp cost by-provider --company-id <company-id>
npx andrecomp cost by-biller --company-id <company-id>
npx andrecomp cost by-project --company-id <company-id>
npx andrecomp cost window-spend --company-id <company-id>
npx andrecomp cost quota-windows --company-id <company-id>
npx andrecomp cost issue <issue-id>
npx andrecomp cost event:create --company-id <company-id> --payload-json '{...}'
```

```sh
npx andrecomp finance event:create --company-id <company-id> --payload-json '{...}'
npx andrecomp finance events --company-id <company-id>
npx andrecomp finance summary --company-id <company-id>
npx andrecomp finance by-biller --company-id <company-id>
npx andrecomp finance by-kind --company-id <company-id>
npx andrecomp budget overview --company-id <company-id>
npx andrecomp budget policy:upsert --company-id <company-id> --payload-json '{...}'
npx andrecomp budget company:update --company-id <company-id> --payload-json '{...}'
npx andrecomp budget agent:update <agent-id> --payload-json '{...}'
npx andrecomp budget incident:resolve <incident-id> --company-id <company-id> [--payload-json '{...}']
```

## Workspace And Environment Commands

```sh
npx andrecomp workspace list --company-id <company-id>
npx andrecomp workspace get <execution-workspace-id>
npx andrecomp workspace close-readiness <execution-workspace-id>
npx andrecomp workspace operations <execution-workspace-id>
npx andrecomp workspace update <execution-workspace-id> --payload-json '{...}'
npx andrecomp workspace runtime-service <execution-workspace-id> start --payload-json '{...}'
npx andrecomp workspace runtime-command <execution-workspace-id> run --payload-json '{...}'
```

```sh
npx andrecomp environment list --company-id <company-id>
npx andrecomp environment capabilities --company-id <company-id>
npx andrecomp environment create --company-id <company-id> --payload-json '{...}'
npx andrecomp environment get <environment-id>
npx andrecomp environment leases <environment-id>
npx andrecomp environment lease <lease-id>
npx andrecomp environment update <environment-id> --payload-json '{...}'
npx andrecomp environment delete <environment-id>
npx andrecomp environment probe <environment-id>
npx andrecomp environment probe-config --company-id <company-id> --payload-json '{...}'
```

```sh
npx andrecomp project-workspace list <project-id>
npx andrecomp project-workspace create <project-id> --payload-json '{...}'
npx andrecomp project-workspace update <project-id> <workspace-id> --payload-json '{...}'
npx andrecomp project-workspace delete <project-id> <workspace-id>
npx andrecomp project-workspace runtime-service <project-id> <workspace-id> restart --payload-json '{...}'
npx andrecomp project-workspace runtime-command <project-id> <workspace-id> run --payload-json '{...}'
```

## Plugin Commands

Existing plugin lifecycle commands remain available: `plugin init`, `list`, `install`, `uninstall`, `enable`, `disable`, `inspect`, and `examples`.

```sh
npx andrecomp plugin ui-contributions
npx andrecomp plugin tools
npx andrecomp plugin tool:execute --payload-json '{...}'
npx andrecomp plugin health <plugin-id>
npx andrecomp plugin logs <plugin-id>
npx andrecomp plugin upgrade <plugin-id>
npx andrecomp plugin config <plugin-id> --company-id <company-id>
npx andrecomp plugin config:set <plugin-id> --company-id <company-id> --payload-json '{"configJson":{...}}'
npx andrecomp plugin config:test <plugin-id> --company-id <company-id> --payload-json '{"configJson":{...}}'
npx andrecomp plugin jobs <plugin-id>
npx andrecomp plugin job:runs <plugin-id> <job-id>
npx andrecomp plugin job:trigger <plugin-id> <job-id> [--payload-json '{...}']
npx andrecomp plugin webhook <plugin-id> <endpoint-key> [--payload-json '{...}']
npx andrecomp plugin dashboard <plugin-id>
npx andrecomp plugin bridge:data <plugin-id> --payload-json '{...}'
npx andrecomp plugin bridge:action <plugin-id> --payload-json '{...}'
npx andrecomp plugin bridge:stream <plugin-id> <channel> [--duration-ms 10000]
npx andrecomp plugin data <plugin-id> <key> --payload-json '{...}'
npx andrecomp plugin action <plugin-id> <key> --payload-json '{...}'
npx andrecomp plugin local-folders <plugin-id> --company-id <company-id>
npx andrecomp plugin local-folder:status <plugin-id> <folder-key> --company-id <company-id>
npx andrecomp plugin local-folder:validate <plugin-id> <folder-key> --company-id <company-id> [--payload-json '{...}']
npx andrecomp plugin local-folder:set <plugin-id> <folder-key> --company-id <company-id> --payload-json '{...}'
```

Feedback traces can be fetched directly by ID when automating export workflows:

```sh
npx andrecomp feedback trace <trace-id>
npx andrecomp feedback bundle <trace-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
npx andrecomp heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Local Andrecomp data lives under the selected instance root. `ANDRECOMP_HOME` chooses the home directory and `ANDRECOMP_INSTANCE_ID` chooses the instance.

```text
~/.andrecomp/                                     # ANDRECOMP_HOME
└── instances/
    └── default/                                  # instance root (ANDRECOMP_INSTANCE_ID)
        ├── config.json                           # runtime config
        ├── .env                                  # instance env file
        ├── db/                                   # embedded PostgreSQL data
        ├── data/
        │   ├── storage/                          # local_disk uploads
        │   └── backups/                          # automatic DB backups
        ├── logs/
        ├── secrets/
        │   └── master.key                        # local_encrypted master key
        ├── workspaces/                           # default agent workspaces
        ├── projects/                             # project execution workspaces
        ├── companies/                            # per-company adapter homes (e.g. codex-home)
        └── codex-home/                           # per-instance codex home (when not company-scoped)
```

Default paths for the canonical install:

- config: `~/.andrecomp/instances/default/config.json`
- embedded db: `~/.andrecomp/instances/default/db`
- logs: `~/.andrecomp/instances/default/logs`
- storage: `~/.andrecomp/instances/default/data/storage`
- secrets key: `~/.andrecomp/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
ANDRECOMP_HOME=/custom/home ANDRECOMP_INSTANCE_ID=dev pnpm andrecomp run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm andrecomp configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
