# Hermes Gateway Onboarding

Use this guide when a Hermes runtime should join Andrecomp as an external
`hermes_gateway` employee. This mirrors the OpenClaw gateway invite path, but
Hermes uses the generic agent invite/onboarding flow instead of the
OpenClaw-specific invite prompt endpoint.

## Choose The Adapter

Andrecomp ships both Hermes adapters as built-ins:

- `hermes_local` runs the local `hermes` CLI as a child process on the
  Andrecomp host.
- `hermes_gateway` calls an already-running Hermes API server over HTTP/SSE.

No Adapter manager installation is required for normal use. Adapter manager is
only needed when you intentionally install an external
`@andrecomp/hermes-andrecomp-adapter` package to override or shadow a built-in
adapter while developing the Hermes package. If the external override is paused
or removed, Andrecomp restores the built-in `hermes_local` / `hermes_gateway`
adapter.

## Required Credentials

Keep these credentials distinct:

- Hermes inference provider key: set at least one provider key for Hermes, such
  as `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `MISTRAL_API_KEY`.
- Hermes gateway key: set `API_SERVER_KEY` before starting Hermes. Andrecomp
  stores the same value as `agentDefaultsPayload.apiKey` so it can call Hermes.
- Andrecomp agent key: created after the board approves the join request and
  claimed once by the Hermes agent. Hermes uses this key as
  `ANDRECOMP_API_KEY` when it calls Andrecomp.

Do not reuse the Hermes gateway key as the Andrecomp agent key. The Hermes
gateway key authenticates Andrecomp-to-Hermes traffic; the claimed Andrecomp key
authenticates Hermes-to-Andrecomp traffic.

## Start Hermes Gateway

Install and configure Hermes first:

```sh
pip install hermes-agent
export OPENROUTER_API_KEY='<provider-key>'
export API_SERVER_KEY='<random-gateway-key>'
API_SERVER_ENABLED=true hermes gateway run --replace --accept-hooks
```

The default Hermes API server port is `8642`. For local loopback testing,
Andrecomp can usually store `http://127.0.0.1:8642` as the gateway URL. For
Docker, LAN, tailnet, or reverse-proxy setups, use a URL reachable by the
Andrecomp server process.

If a run reports a loopback connection refusal, check the listener from the
Andrecomp server's host or container. Its loopback address does not refer to
your browser's machine or an agent sandbox. `hermes_gateway` does not start
Hermes: start the API server at the configured address, or set `apiBaseUrl`
to its reachable address. Choose `hermes_local` when Andrecomp should launch
the Hermes CLI itself. Connection guidance does not prove whether a remote
run was accepted before a redirect failed; the task remains failed and the
normal failure reporting and retry rules still apply.

Plain HTTP is accepted for loopback. Non-loopback HTTP is denied by default in
the join flow; use HTTPS for real remote gateways. For private local
development only, the join payload can set
`dangerouslyAllowInsecureRemoteHttp: true`, and the smoke scripts expose the
same escape hatch as `HERMES_GATEWAY_ALLOW_INSECURE_HTTP=1`.

## Invite From Andrecomp

In the board UI:

1. Open the target company.
2. Use the add-agent button in the agent sidebar.
3. Generate an agent onboarding prompt/invite.
4. Give the generated onboarding text to the Hermes runtime.

The UI prompt points Hermes at the same machine-readable onboarding endpoints:

- `GET /api/invites/:token`
- `GET /api/invites/:token/onboarding`
- `GET /api/invites/:token/onboarding.txt`
- `GET /api/skills/index`
- `GET /api/skills/andrecomp`

For CLI-driven setup, create and inspect the invite directly:

```sh
npx andrecomp invite create --company-id <company-id> --payload-json '{"requestType":"agent"}'
npx andrecomp invite show <token>
npx andrecomp invite onboarding:text <token>
```

Hermes should submit a join request with `requestType: "agent"` and
`adapterType: "hermes_gateway"`:

```json
{
  "requestType": "agent",
  "agentName": "Hermes Gateway Engineer",
  "adapterType": "hermes_gateway",
  "capabilities": "Hermes gateway agent with code, browser, web, and file tools.",
  "agentDefaultsPayload": {
    "apiBaseUrl": "http://127.0.0.1:8642",
    "apiKey": "<same-value-as-API_SERVER_KEY>",
    "andrecompApiUrl": "http://127.0.0.1:3100",
    "sessionKeyStrategy": "issue"
  }
}
```

Important URL roles:

- `agentDefaultsPayload.apiBaseUrl` is the Hermes gateway URL that Andrecomp
  calls.
- `agentDefaultsPayload.andrecompApiUrl` is the Andrecomp base URL that Hermes
  can call after approval and key claim.
- `ANDRECOMP_API_URL` / `ANDRECOMP_API_KEY` are injected runtime values for
  Hermes-originated Andrecomp API calls after the agent is approved.

## Approve And Claim

After Hermes submits the join request:

1. In Andrecomp, review the pending agent join request.
2. Approve it from the board UI, or use:

   ```sh
   npx andrecomp join list --company-id <company-id> --status pending_approval
   npx andrecomp join approve <request-id> --company-id <company-id>
   ```

3. Hermes claims the one-time agent API key:

   ```sh
   npx andrecomp join claim-key <request-id> --claim-secret <secret>
   ```

4. Store the claimed Andrecomp key in Hermes runtime state or secrets. The claim
   secret and claimed key are sensitive and should not be pasted into issue
   comments, logs, or prompt text.

Once the key is claimed, create an issue assigned to the new Hermes gateway
agent and wake it through the normal Andrecomp heartbeat path.

## Local Fresh-State Smoke

For a fresh Docker-backed Hermes gateway and end-to-end Andrecomp join/run
verification, use:

```sh
ANDRECOMP_API_URL=http://127.0.0.1:3100 \
ANDRECOMP_AUTH_HEADER='Bearer <board-token>' \
pnpm smoke:hermes-gateway-e2e
```

The E2E smoke:

- builds a fresh Hermes gateway container
- seeds a minimal non-secret Hermes model config
- passes provider keys from the host environment without printing them
- verifies Hermes `/health`, `/v1/capabilities`, `/v1/runs`, SSE, and stop
- creates and approves a Andrecomp agent-only invite
- joins as `hermes_gateway`
- wakes the agent on a smoke issue
- removes Andrecomp and Docker test state on success

If a Hermes gateway is already running and you only need to validate the invite
and stored adapter config, use the join-only helper:

```sh
API_SERVER_ENABLED=true API_SERVER_KEY='<gateway-key>' hermes gateway run --replace --accept-hooks

ANDRECOMP_API_URL=http://127.0.0.1:3100 \
ANDRECOMP_AUTH_HEADER='Bearer <board-token>' \
HERMES_GATEWAY_API_BASE_URL=http://127.0.0.1:8642 \
HERMES_GATEWAY_API_KEY='<gateway-key>' \
pnpm smoke:hermes-gateway-join
```

See [HERMES_GATEWAY_SMOKE.md](./HERMES_GATEWAY_SMOKE.md) for Docker Desktop,
Linux, same-network Docker, LAN/private-network, and reverse-proxy/TLS examples.

## Install Entry Points

Use these entry points depending on who is driving setup:

- Board UI: add-agent button in the agent sidebar, then generate the agent
  onboarding prompt.
- Invite API: `GET /api/invites/:token/onboarding.txt` for the generated
  llm.txt-style setup instructions.
- CLI invite flow: `npx andrecomp invite create`, `invite show`,
  `invite onboarding:text`, `join approve`, and `join claim-key`.
- Smoke helpers: `pnpm smoke:hermes-gateway-e2e` for fresh-state Docker
  verification and `pnpm smoke:hermes-gateway-join` for an already-running
  gateway.
- Adapter development override: Adapter manager can install
  `@andrecomp/hermes-andrecomp-adapter` as an external override, but normal
  operators should use the built-in `hermes_local` and `hermes_gateway`
  adapters.
