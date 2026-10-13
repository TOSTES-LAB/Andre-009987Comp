#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[openclaw-sse-standalone] $*"
}

fail() {
  echo "[openclaw-sse-standalone] ERROR: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
}

require_cmd curl
require_cmd jq
require_cmd grep

OPENCLAW_URL="${OPENCLAW_URL:-}"
OPENCLAW_METHOD="${OPENCLAW_METHOD:-POST}"
OPENCLAW_AUTH_HEADER="${OPENCLAW_AUTH_HEADER:-}"
OPENCLAW_TIMEOUT_SEC="${OPENCLAW_TIMEOUT_SEC:-180}"
OPENCLAW_MODEL="${OPENCLAW_MODEL:-openclaw}"
OPENCLAW_USER="${OPENCLAW_USER:-andrecomp-smoke}"

ANDRECOMP_RUN_ID="${ANDRECOMP_RUN_ID:-smoke-run-$(date +%s)}"
ANDRECOMP_AGENT_ID="${ANDRECOMP_AGENT_ID:-openclaw-smoke-agent}"
ANDRECOMP_COMPANY_ID="${ANDRECOMP_COMPANY_ID:-openclaw-smoke-company}"
ANDRECOMP_API_URL="${ANDRECOMP_API_URL:-http://localhost:3100}"
ANDRECOMP_TASK_ID="${ANDRECOMP_TASK_ID:-openclaw-smoke-task}"
ANDRECOMP_WAKE_REASON="${ANDRECOMP_WAKE_REASON:-openclaw_smoke_test}"
ANDRECOMP_WAKE_COMMENT_ID="${ANDRECOMP_WAKE_COMMENT_ID:-}"
ANDRECOMP_APPROVAL_ID="${ANDRECOMP_APPROVAL_ID:-}"
ANDRECOMP_APPROVAL_STATUS="${ANDRECOMP_APPROVAL_STATUS:-}"
ANDRECOMP_LINKED_ISSUE_IDS="${ANDRECOMP_LINKED_ISSUE_IDS:-}"
OPENCLAW_TEXT_PREFIX="${OPENCLAW_TEXT_PREFIX:-Standalone OpenClaw SSE smoke test.}"

[[ -n "$OPENCLAW_URL" ]] || fail "OPENCLAW_URL is required"

read -r -d '' TEXT_BODY <<EOF || true
${OPENCLAW_TEXT_PREFIX}

ANDRECOMP_RUN_ID=${ANDRECOMP_RUN_ID}
ANDRECOMP_AGENT_ID=${ANDRECOMP_AGENT_ID}
ANDRECOMP_COMPANY_ID=${ANDRECOMP_COMPANY_ID}
ANDRECOMP_API_URL=${ANDRECOMP_API_URL}
ANDRECOMP_TASK_ID=${ANDRECOMP_TASK_ID}
ANDRECOMP_WAKE_REASON=${ANDRECOMP_WAKE_REASON}
ANDRECOMP_WAKE_COMMENT_ID=${ANDRECOMP_WAKE_COMMENT_ID}
ANDRECOMP_APPROVAL_ID=${ANDRECOMP_APPROVAL_ID}
ANDRECOMP_APPROVAL_STATUS=${ANDRECOMP_APPROVAL_STATUS}
ANDRECOMP_LINKED_ISSUE_IDS=${ANDRECOMP_LINKED_ISSUE_IDS}

Run your Andrecomp heartbeat procedure now.
EOF

PAYLOAD="$(jq -nc \
  --arg text "$TEXT_BODY" \
  --arg model "$OPENCLAW_MODEL" \
  --arg user "$OPENCLAW_USER" \
  --arg runId "$ANDRECOMP_RUN_ID" \
  --arg agentId "$ANDRECOMP_AGENT_ID" \
  --arg companyId "$ANDRECOMP_COMPANY_ID" \
  --arg apiUrl "$ANDRECOMP_API_URL" \
  --arg taskId "$ANDRECOMP_TASK_ID" \
  --arg wakeReason "$ANDRECOMP_WAKE_REASON" \
  --arg wakeCommentId "$ANDRECOMP_WAKE_COMMENT_ID" \
  --arg approvalId "$ANDRECOMP_APPROVAL_ID" \
  --arg approvalStatus "$ANDRECOMP_APPROVAL_STATUS" \
  --arg linkedIssueIds "$ANDRECOMP_LINKED_ISSUE_IDS" \
  '{
    model: $model,
    user: $user,
    input: $text,
    stream: true,
    metadata: {
      ANDRECOMP_RUN_ID: $runId,
      ANDRECOMP_AGENT_ID: $agentId,
      ANDRECOMP_COMPANY_ID: $companyId,
      ANDRECOMP_API_URL: $apiUrl,
      ANDRECOMP_TASK_ID: $taskId,
      ANDRECOMP_WAKE_REASON: $wakeReason,
      ANDRECOMP_WAKE_COMMENT_ID: $wakeCommentId,
      ANDRECOMP_APPROVAL_ID: $approvalId,
      ANDRECOMP_APPROVAL_STATUS: $approvalStatus,
      ANDRECOMP_LINKED_ISSUE_IDS: $linkedIssueIds,
      andrecomp_session_key: ("andrecomp:run:" + $runId)
    }
  }')"

headers_file="$(mktemp)"
body_file="$(mktemp)"
cleanup() {
  rm -f "$headers_file" "$body_file"
}
trap cleanup EXIT

args=(
  -sS
  -N
  --max-time "$OPENCLAW_TIMEOUT_SEC"
  -X "$OPENCLAW_METHOD"
  -H "content-type: application/json"
  -H "accept: text/event-stream"
  -H "x-openclaw-session-key: andrecomp:run:${ANDRECOMP_RUN_ID}"
  -D "$headers_file"
  -o "$body_file"
  --data "$PAYLOAD"
  "$OPENCLAW_URL"
)

if [[ -n "$OPENCLAW_AUTH_HEADER" ]]; then
  args=(-H "Authorization: $OPENCLAW_AUTH_HEADER" "${args[@]}")
fi

log "posting SSE wake payload to ${OPENCLAW_URL}"
http_code="$(curl "${args[@]}" -w "%{http_code}")"
log "http status: ${http_code}"

if [[ ! "$http_code" =~ ^2 ]]; then
  tail -n 80 "$body_file" >&2 || true
  fail "non-success HTTP status: ${http_code}"
fi

if ! grep -Eqi '^content-type:.*text/event-stream' "$headers_file"; then
  tail -n 40 "$body_file" >&2 || true
  fail "response content-type was not text/event-stream"
fi

if grep -Eqi 'event:\s*(error|failed|cancel)|"status":"(failed|cancelled|error)"|"type":"[^"]*(failed|cancelled|error)"' "$body_file"; then
  tail -n 120 "$body_file" >&2 || true
  fail "stream reported a failure event"
fi

if ! grep -Eqi 'event:\s*(done|completed|response\.completed)|\[DONE\]|"status":"(completed|succeeded|done)"|"type":"response\.completed"' "$body_file"; then
  tail -n 120 "$body_file" >&2 || true
  fail "stream ended without a terminal completion marker"
fi

event_count="$(grep -Ec '^event:' "$body_file" || true)"
log "stream completed successfully (events=${event_count})"
echo
tail -n 40 "$body_file"
