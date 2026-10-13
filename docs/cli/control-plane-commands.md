---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
npx andrecomp issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
npx andrecomp issue get <issue-id-or-identifier>

# Create issue
npx andrecomp issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
npx andrecomp issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
npx andrecomp issue comment <issue-id> --body "..." [--reopen]

# Checkout task
npx andrecomp issue checkout <issue-id> --agent-id <agent-id>

# Release task
npx andrecomp issue release <issue-id>
```

## Company Commands

```sh
npx andrecomp company list
npx andrecomp company get <company-id>
npx andrecomp company current [--company-id <company-id>]

# Export to portable folder package (writes manifest + markdown files)
npx andrecomp company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
npx andrecomp company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
npx andrecomp company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

`company import` is unavailable against cloud-managed instances — the
server answers `403` with `code: "cloud_managed"`. Export remains available
there.

With agent authentication, use `company list` or `company current` to resolve
the scoped company. `company list` first tries the board-wide list; if that is
forbidden, it falls back to `--company-id`, `ANDRECOMP_COMPANY_ID`, context, or
`/api/agents/me` and returns only that scoped company. `company create` requires
board/instance-admin authentication because it is an instance-wide setup
command.

## Agent Commands

```sh
npx andrecomp agent list
npx andrecomp agent get <agent-id>
```

## Skills Commands

```sh
# Browse app-shipped catalog skills without changing company state
npx andrecomp skills browse [--kind bundled|optional] [--category software-development] [--query github]
npx andrecomp skills search "pull request" [--json]

# Inspect catalog metadata and file inventory before install
npx andrecomp skills inspect github-pr-workflow

# Install a catalog skill into the company skill library
# This does not attach the skill to any agent.
npx andrecomp skills install github-pr-workflow --company-id <company-id>
npx andrecomp skills install github-pr-workflow --as pr-flow --force --company-id <company-id>

# External sources still use import instead of catalog install
npx andrecomp skills import ./skills/my-skill --company-id <company-id>
npx andrecomp skills import owner/repo/path/to/skill --company-id <company-id>

# Attach desired company skills to an agent after install/import
npx andrecomp skills agent sync <agent-id> --skill github-pr-workflow --mode add --company-id <company-id>
```

## Approval Commands

```sh
# List approvals
npx andrecomp approval list [--status pending]

# Get approval
npx andrecomp approval get <approval-id>

# Create approval
npx andrecomp approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
npx andrecomp approval approve <approval-id> [--decision-note "..."]

# Reject
npx andrecomp approval reject <approval-id> [--decision-note "..."]

# Request revision
npx andrecomp approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
npx andrecomp approval resubmit <approval-id> [--payload '{"..."}']

# Comment
npx andrecomp approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
npx andrecomp activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
npx andrecomp dashboard get
```

## Instance Settings

```sh
npx andrecomp instance settings:general
npx andrecomp instance settings:general:update --payload-json '{...}'
npx andrecomp instance settings:experimental
npx andrecomp instance settings:experimental:update --payload-json '{...}'
```

Experimental features are opt-in and are provided without compatibility guarantees. They may break, change, or be removed at any time. Use them at your own risk.

## Heartbeat

```sh
npx andrecomp heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
