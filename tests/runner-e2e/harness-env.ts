import { installedDaytonaPluginKeys } from "./installed-daytona-plugin.js";
import { QUALIFIED_ACPX_PROFILES } from "../../packages/andrecomp-runner/src/drivers/acpx/qualified-profiles.js";
import { assertInstalledCliSelection, installedCliKeys, usesInstalledCli } from "./installed-cli.js";
import path from "node:path";
import { isEvalRemoteOrigin } from "./eval-remote-gateway.js";
import { chatNeedsApiTools, isManagedHiringCase } from "./chat-cases.js";
import { CREDENTIAL_NAMES } from "./types.js";
import type { MatrixExecution } from "./types.js";

const DATABASE_KEYS = ["DATABASE_URL", "DATABASE_MIGRATION_URL"] as const;
const AMBIENT_ANDRECOMP_CREDENTIAL_KEYS = [
  "ANDRECOMP_API_KEY",
  "ANDRECOMP_ACPX_CANDIDATE_ADMISSION",
  "ANDRECOMP_AGENT_API_KEY",
  "ANDRECOMP_TASK_BRIDGE_TOKEN",
  "ANDRECOMP_E2E_GATEWAY_TOKEN",
  "ANDRECOMP_E2E_GATEWAY_PHASE_PATH",
  "ANDRECOMP_E2E_OTLP_RELAY_URL",
  "ANDRECOMP_E2E_REMOTE_GATEWAY_ORIGIN",
  "ANDRECOMP_SETUP_TOKEN",
  "ANDRECOMP_SECRETS_MASTER_KEY",
  "ANDRECOMP_SECRETS_MASTER_KEY_FILE",
] as const;
const GENERATED_SERVER_SECRET_KEYS = [
  "ANDRECOMP_AGENT_JWT_SECRET",
  "ANDRECOMP_DECISION_SIGNING_SECRET",
  "ANDRECOMP_TOOL_ACTION_SIGNING_SECRET",
  "BETTER_AUTH_SECRET",
] as const;
const AMBIENT_EXTERNAL_STATE_KEYS = [
  "ANDRECOMP_STORAGE_S3_BUCKET",
  "ANDRECOMP_STORAGE_S3_REGION",
  "ANDRECOMP_STORAGE_S3_ENDPOINT",
  "ANDRECOMP_STORAGE_S3_PREFIX",
  "ANDRECOMP_STORAGE_S3_FORCE_PATH_STYLE",
] as const;
const PROVIDER_SECRET_KEY = /^(?:OPENAI|ANTHROPIC|OPENROUTER|BRAINTRUST|DAYTONA|XAI|GROK|KIMI|CURSOR|COPILOT|GITHUB|GH)(?:_|$)/;

export function applyEvalGatewayEnvironment(env: NodeJS.ProcessEnv, credential: string, gateway: {
  token: string; baseUrl: string; phasePath: string; observability?: { token: string; baseUrl: string };
}) {
  for (const name of Object.keys(env)) {
    if (CREDENTIAL_NAMES.includes(name as typeof CREDENTIAL_NAMES[number])
      || PROVIDER_SECRET_KEY.test(name) && /KEY|TOKEN|SECRET|PASSWORD/.test(name)) delete env[name];
  }
  delete env.ANDRECOMP_E2E_OTLP_RELAY_URL;
  delete env.ANDRECOMP_E2E_REMOTE_GATEWAY_ORIGIN;
  if (isEvalRemoteOrigin(gateway.baseUrl)) env.ANDRECOMP_E2E_REMOTE_GATEWAY_ORIGIN = gateway.baseUrl;
  env[credential] = gateway.token;
  env.ANDRECOMP_E2E_GATEWAY_BASE_URL = gateway.baseUrl;
  env.ANDRECOMP_E2E_GATEWAY_TOKEN = gateway.token;
  env.ANDRECOMP_E2E_GATEWAY_PHASE_PATH = gateway.phasePath;
  if (gateway.observability) {
    env.BRAINTRUST_API_KEY = gateway.observability.token;
    env.ANDRECOMP_E2E_OTLP_RELAY_URL = gateway.observability.baseUrl;
  }
}

export function runnerE2EServerControlPaths(temporaryRoot: string) {
  const controlDirectory = path.join(temporaryRoot, "control");
  return {
    controlDirectory,
    restartRequestPath: path.join(
      controlDirectory,
      "server-restart.request.json",
    ),
    restartAcknowledgementPath: path.join(
      controlDirectory,
      "server-restart.ack.json",
    ),
  };
}

/**
 * Native cells use the debug binary produced once by build:runner-binaries.
 * Preserve an explicit override for release builds and developer workflows.
 */
export function resolveAndrecompRunnerBinaryForHarness(
  executions: readonly MatrixExecution[],
  repositoryRoot: string,
  configuredPath = process.env.ANDRECOMP_RUNNER_BINARY,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  if (configuredPath?.trim()) return configuredPath;
  if (
    !executions.some((execution) => execution.profile.generation === "native")
  ) {
    return undefined;
  }

  return path.join(
    repositoryRoot,
    "packages",
    "andrecomp-runner",
    "runner",
    "target",
    "debug",
    platform === "win32" ? "andrecomp-runnerd.exe" : "andrecomp-runnerd",
  );
}

/**
 * Remote native cells stage the same controller-owned binary whose digest is
 * authorized by the PRP control plane. Local cells launch it directly.
 */
export function resolveAndrecompRemoteRunnerBinaryForHarness(
  executions: readonly MatrixExecution[],
  runnerBinary: string | undefined,
  configuredPath = process.env.ANDRECOMP_RUNNER_REMOTE_BINARY_PATH,
  platform: NodeJS.Platform = process.platform,
  architecture: NodeJS.Architecture = process.arch,
): string | undefined {
  if (configuredPath?.trim()) return configuredPath;
  if (!runnerBinary) return undefined;
  // The pinned Daytona runtime is Linux/x64. Other controller binaries cannot
  // run there; discover its verified runnerd unless an explicit cross-build is set.
  if (platform !== "linux" || architecture !== "x64") return undefined;
  return executions.some(
    (execution) =>
      execution.profile.generation === "native" &&
      execution.environment.expectedExecutionTarget.kind === "remote",
  )
    ? runnerBinary
    : undefined;
}

/**
 * Keep fixture-only provider switches scoped to the one isolated harness that
 * needs them. In particular, the pinned legacy OpenCode model is routed by the
 * paid gateway and may not appear in OpenCode's public model catalog.
 */
export function buildRunnerE2EProcessEnvironment(
  source: NodeJS.ProcessEnv,
  executions: readonly MatrixExecution[],
): NodeJS.ProcessEnv {
  const installed = usesInstalledCli(source);
  if (installed) assertInstalledCliSelection(source, executions);
  const result = { ...source };
  delete result.ANDRECOMP_RUNNER_E2E_POSTGRES_ADMIN_URL;
  // The supervisor's read-only recovery observer must use the same disposable
  // instance key as the serving child, never a launching shell's vault key.
  delete result.ANDRECOMP_SECRETS_MASTER_KEY;
  delete result.ANDRECOMP_SECRETS_MASTER_KEY_FILE;
  delete result.ANDRECOMP_E2E_GATEWAY_PHASE_PATH;
  delete result.ANDRECOMP_E2E_OTLP_RELAY_URL;
  delete result.ANDRECOMP_E2E_REMOTE_GATEWAY_ORIGIN;
  // Announcements are unrelated to the scenarios and obscure screenshot evidence.
  result.ANDRECOMP_ANNOUNCEMENTS_ENABLED = "false";
  delete result.OPENCODE_ALLOW_ALL_MODELS;
  // Discard ambient admission. Only explicit candidate cells authorize the
  // exact model in their isolated server; credentials still use company secrets.
  delete result.ANDRECOMP_RUNNER_ACPX_QUALIFICATION;
  delete result.ANDRECOMP_ACPX_CANDIDATE_ADMISSION;
  const candidates = new Map<string, string>();
  for (const execution of executions) {
    const agent = execution.profile.qualificationCandidate;
    if (!agent) continue;
    const admittedSuite = agent === "kimi"
      ? execution.suite.id === "kimi-qualification" && execution.profile.id === "runner-acpx-kimi"
      : execution.suite.id === "extended-harnesses"
      || execution.suite.id === "rich-acp-warm-continuity"
      || (execution.suite.id === "pi-native" && agent === "pi")
      || (execution.suite.id === "pi-controls" && agent === "pi")
      || (["cursor-native", "native-provider-loss"].includes(execution.suite.id) && agent === "cursor")
      || (["copilot-protection", "copilot-provider-death"].includes(execution.suite.id) && agent === "copilot")
      || (execution.suite.id === "native-active-stop" && (agent === "cursor" || agent === "copilot"));
    if (!admittedSuite || !execution.suite.manualOnly) {
      throw new Error("Candidate qualification requires an explicit provider qualification suite");
    }
    if (QUALIFIED_ACPX_PROFILES[agent].qualificationStatus !== "pending") {
      continue;
    }
    if (agent === "kimi") continue;
    const prior = candidates.get(agent);
    if (prior !== undefined && prior !== execution.profile.model) throw new Error("Conflicting candidate models");
    candidates.set(agent, execution.profile.model);
  }
  // Installed lanes must prove normal production admission without candidate overrides.
  if (candidates.size > 0 && !installed) {
    result.ANDRECOMP_RUNNER_ACPX_QUALIFICATION = JSON.stringify(
      [...candidates].map(([agent, model]) => ({ agent, model })),
    );
  }
  // These stories explicitly require the native API surface. Other suites
  // retain the server default or any supplied operator restriction.
  if (executions.some((e) => isManagedHiringCase(e.suite.id, e.task.id) || chatNeedsApiTools(e.suite.id, e.task.id))) {
    result.ANDRECOMP_RUNNER_API_TOOLS_ENABLED = "true";
  }
  if (
    executions.length > 0 &&
    executions.every(
      (execution) =>
        execution.profile.generation === "legacy" &&
        execution.profile.provider === "opencode",
    )
  ) {
    result.OPENCODE_ALLOW_ALL_MODELS = "true";
  }
  return result;
}

/**
 * Build the environment inherited by the Andrecomp server. Paid credentials
 * deliberately stay in the launcher/Playwright process and cross the server
 * boundary through encrypted company secrets. Explicit subscription fixtures
 * stage their login in the disposable company's private credential home.
 */
export function buildAndrecompServerEnvironment(
  source: NodeJS.ProcessEnv,
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const result = { ...source };
  delete result.ANDRECOMP_RUNNER_E2E_POSTGRES_ADMIN_URL;
  for (const key of Object.keys(result)) {
    if (PROVIDER_SECRET_KEY.test(key)) delete result[key];
  }
  for (const key of [
    ...CREDENTIAL_NAMES,
    ...DATABASE_KEYS,
    ...AMBIENT_ANDRECOMP_CREDENTIAL_KEYS,
    ...AMBIENT_EXTERNAL_STATE_KEYS,
  ]) {
    delete result[key];
  }
  for (const key of [...GENERATED_SERVER_SECRET_KEYS, ...installedCliKeys, ...installedDaytonaPluginKeys, "ANDRECOMP_RUNNER_E2E_UPGRADE_ARTIFACTS"]) delete result[key];
  Object.assign(result, overrides);
  return result;
}

export function assertIsolatedServerEnvironment(
  env: NodeJS.ProcessEnv,
  expected: {
    temporaryRoot: string;
    andrecompHome: string;
    configPath: string;
  },
) {
  const home = env.ANDRECOMP_HOME;
  const config = env.ANDRECOMP_CONFIG;
  if (home !== expected.andrecompHome || config !== expected.configPath) {
    throw new Error(
      "Andrecomp server environment does not use the allocated home/config paths",
    );
  }
  if (
    !home.startsWith(`${expected.temporaryRoot}/`) ||
    !config.startsWith(`${expected.temporaryRoot}/`)
  ) {
    throw new Error(
      "Andrecomp server paths escape the isolated temporary root",
    );
  }
  if (env.XDG_CACHE_HOME !== path.join(expected.temporaryRoot, "xdg-cache")) {
    throw new Error(
      "Andrecomp server cache does not use the allocated temporary root",
    );
  }
  for (const key of [
    ...CREDENTIAL_NAMES,
    ...DATABASE_KEYS,
    ...AMBIENT_ANDRECOMP_CREDENTIAL_KEYS,
    ...AMBIENT_EXTERNAL_STATE_KEYS,
  ]) {
    if (env[key])
      throw new Error(
        `Andrecomp server environment unexpectedly contains ${key}`,
      );
  }
  for (const key of GENERATED_SERVER_SECRET_KEYS) {
    if (!env[key])
      throw new Error(`Andrecomp server environment is missing ${key}`);
  }
}
