# Andrecomp MCP Server

Model Context Protocol server for Andrecomp.

This package is a thin MCP wrapper over the existing Andrecomp REST API. It does
not talk to the database directly and it does not reimplement business logic.

## Authentication

The server reads its configuration from environment variables:

- `ANDRECOMP_API_URL` - Andrecomp base URL, for example `http://localhost:3100`
- `ANDRECOMP_API_KEY` - bearer token used for `/api` requests
- `ANDRECOMP_COMPANY_ID` - optional default company for company-scoped tools
- `ANDRECOMP_AGENT_ID` - optional default agent for checkout helpers
- `ANDRECOMP_RUN_ID` - optional run id forwarded on mutating requests

Inside an active heartbeat, Andrecomp also injects `ANDRECOMP_RUNTIME_TOOLS_*` variables. They enable the run-scoped `connections_search` and `connection_request` tools and expire with the run.

## Usage

```sh
npx -y @andrecomp/mcp-server
```

Or locally in this repo:

```sh
pnpm --filter @andrecomp/mcp-server build
node packages/mcp-server/dist/stdio.js
```

## Tool Surface

Run-scoped connection tools:

- `connections_search`
- `connection_request`

Read tools:

- `andrecompMe`
- `andrecompInboxLite`
- `andrecompListAgents`
- `andrecompGetAgent`
- `andrecompListIssues`
- `andrecompGetIssue`
- `andrecompGetHeartbeatContext`
- `andrecompListComments`
- `andrecompGetComment`
- `andrecompListIssueApprovals`
- `andrecompListDocuments`
- `andrecompGetDocument`
- `andrecompListDocumentRevisions`
- `andrecompListProjects`
- `andrecompGetProject`
- `andrecompGetIssueWorkspaceRuntime`
- `andrecompWaitForIssueWorkspaceService`
- `andrecompListGoals`
- `andrecompGetGoal`
- `andrecompListApprovals`
- `andrecompGetApproval`
- `andrecompGetApprovalIssues`
- `andrecompListApprovalComments`

Write tools:

- `andrecompCreateIssue`
- `andrecompUpdateIssue`
- `andrecompCheckoutIssue`
- `andrecompReleaseIssue`
- `andrecompAddComment`
- `andrecompSuggestTasks`
- `andrecompAskUserQuestions`
- `andrecompRequestConfirmation`
- `andrecompUpsertIssueDocument`
- `andrecompRestoreIssueDocumentRevision`
- `andrecompControlIssueWorkspaceServices`
- `andrecompCreateApproval`
- `andrecompLinkIssueApproval`
- `andrecompUnlinkIssueApproval`
- `andrecompApprovalDecision`
- `andrecompAddApprovalComment`

Escape hatch:

- `andrecompApiRequest`

`andrecompApiRequest` is limited to paths under `/api` and JSON bodies. It is
meant for endpoints that do not yet have a dedicated MCP tool.
