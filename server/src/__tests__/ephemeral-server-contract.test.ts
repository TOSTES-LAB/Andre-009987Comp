import { afterEach, expect, it, vi } from "vitest";
import { assertEphemeralServerConfig } from "../services/ephemeral-server-contract.js";
import { assertEphemeralWorkspaceExecution, assertEphemeralNativeRuntime, shouldUseRemoteWorkspaces } from "../services/remote-workspaces.js";
import { assertEphemeralAgentInstructions } from "../services/agent-instructions.js";

const config = { databaseUrl: "postgresql://runtime:fixture@ep-example-pooler.neon.test/tenant", storageProvider: "s3" as const };
const env = { ANDRECOMP_EPHEMERAL_SERVER: "true", ANDRECOMP_DURABLE_AGENT_FILES: "true", ANDRECOMP_SHARED_UI_ASSETS: "true",
  ANDRECOMP_DECISION_SIGNING_SECRET: "synthetic-decision-key-for-deployment-tests",
  ANDRECOMP_SECRETS_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"), // 32-byte fixture, never an operator key
  ANDRECOMP_DATABASE_LISTEN_URL: "postgresql://runtime:fixture@ep-example.neon.test/tenant" };
afterEach(() => vi.unstubAllEnvs());
it("requires shared storage and stable secrets without changing volume-backed startup", () => {
  expect(assertEphemeralServerConfig(config, env)).toBe(env.ANDRECOMP_DATABASE_LISTEN_URL);
  expect(assertEphemeralServerConfig({ storageProvider: "local_disk", databaseUrl: undefined }, {})).toBeNull();
  for (const key of ["ANDRECOMP_DURABLE_AGENT_FILES", "ANDRECOMP_SHARED_UI_ASSETS", "ANDRECOMP_SECRETS_MASTER_KEY", "ANDRECOMP_DECISION_SIGNING_SECRET", "ANDRECOMP_DATABASE_LISTEN_URL"]) {
    expect(() => assertEphemeralServerConfig(config, { ...env, [key]: "" })).toThrow("Volume-free server configuration");
  }
  expect(() => assertEphemeralServerConfig({ ...config, storageProvider: "local_disk" }, env)).toThrow("shared S3");
});
it("never connects the listener with migration privileges, another tenant, or through a transaction pooler", () => {
  for (const url of [env.ANDRECOMP_DATABASE_LISTEN_URL.replace("runtime:", "migration:"),
    env.ANDRECOMP_DATABASE_LISTEN_URL.replace("/tenant", "/neighbor"), config.databaseUrl,
    env.ANDRECOMP_DATABASE_LISTEN_URL.replace("ep-example.", "ep-neighbor.")]) {
    expect(() => assertEphemeralServerConfig(config, { ...env, ANDRECOMP_DATABASE_LISTEN_URL: url })).toThrow("runtime role");
  }
});
it("requires remote workspace authority and native execution independently of provider lifecycle", () => {
  vi.stubEnv("ANDRECOMP_EPHEMERAL_SERVER", "true");
  const remote = { externalConversation: false, adapterType: "andrecomp_runner", pluginTaskWorkspace: false, remoteAuthority: true };
  expect(() => assertEphemeralWorkspaceExecution(remote)).not.toThrow();
  expect(() => assertEphemeralWorkspaceExecution({ ...remote, remoteAuthority: false, pluginTaskWorkspace: true })).not.toThrow();
  for (const patch of [{ remoteAuthority: false }, { adapterType: "process" }]) {
    expect(() => assertEphemeralWorkspaceExecution({ ...remote, ...patch })).toThrow("native Andrecomp Runner");
  }
  expect(() => assertEphemeralNativeRuntime(true)).not.toThrow();
  expect(() => assertEphemeralNativeRuntime(false)).toThrow("native Andrecomp Runner");
  const agent = { id: "agent", companyId: "company", name: "Agent", adapterConfig: {} };
  expect(() => assertEphemeralAgentInstructions(agent)).not.toThrow();
  expect(() => assertEphemeralAgentInstructions({ ...agent, adapterConfig: { instructionsBundleMode: "external", instructionsRootPath: "/old-volume" } })).toThrow("managed agent instructions");
  vi.stubEnv("ANDRECOMP_EPHEMERAL_SERVER", "false");
  expect(() => assertEphemeralWorkspaceExecution({ ...remote, remoteAuthority: false })).not.toThrow();
  expect(() => assertEphemeralNativeRuntime(false)).not.toThrow();
});

it.each(["claude_local", "codex_local"])("admits %s over SSH only with durable remote workspace authority", adapterType => {
  vi.stubEnv("ANDRECOMP_EPHEMERAL_SERVER", "true");
  vi.stubEnv("DATABASE_URL", config.databaseUrl);
  vi.stubEnv("ANDRECOMP_STORAGE_PROVIDER", "s3");
  vi.stubEnv("ANDRECOMP_SECRETS_MASTER_KEY", env.ANDRECOMP_SECRETS_MASTER_KEY);
  const remote = { externalConversation: false, adapterType, environmentDriver: "ssh", pluginTaskWorkspace: false, remoteAuthority: true };
  expect(shouldUseRemoteWorkspaces({ adapterType, environmentDriver: "ssh", experimentalEnabled: true })).toBe(true);
  expect(() => assertEphemeralWorkspaceExecution(remote)).not.toThrow();
  expect(() => assertEphemeralWorkspaceExecution({ ...remote, remoteAuthority: false })).toThrow();
  expect(() => assertEphemeralWorkspaceExecution({ ...remote, environmentDriver: "local" })).toThrow();
  expect(() => assertEphemeralWorkspaceExecution({ ...remote, adapterType: "process" })).toThrow();
  expect(() => assertEphemeralNativeRuntime(false, { ...remote, remoteCwd: "/workspace", authorityCwd: "/workspace" })).not.toThrow();
  expect(() => assertEphemeralNativeRuntime(false, { ...remote, remoteCwd: "/other", authorityCwd: "/workspace" })).toThrow();
});
