import { AGENT_OBSERVABILITY_ENV_KEYS } from "./drivers/agent-observability.js";
/** Names minted by the controller from the resolved task configuration.
 * Values remain in the process environment, never in argv or this manifest.
 * Do not mint this projection from ambient process.env.
 */
export const CONFIGURED_ENVIRONMENT_KEYS = "ANDRECOMP_CONFIGURED_ENV_KEYS";

export const GENERATED_RUNTIME_ENVIRONMENT_KEYS: ReadonlySet<string> = new Set([
  CONFIGURED_ENVIRONMENT_KEYS,
  ...AGENT_OBSERVABILITY_ENV_KEYS,
  "ANDRECOMP_AGENT_ID", "ANDRECOMP_AGENT_KEY_ID", "ANDRECOMP_AGENT_PUBLIC_KEY", "ANDRECOMP_AGENT_PRIVATE_KEY",
  "ANDRECOMP_API_KEY", "ANDRECOMP_API_URL", "ANDRECOMP_API_BRIDGE_MODE", "ANDRECOMP_COMPANY_ID", "ANDRECOMP_INSTANCE_ID",
  "ANDRECOMP_RUNTIME_NOTIFICATION_HELPER", "ANDRECOMP_RUNTIME_NOTIFICATION_CONTEXT", "ANDRECOMP_RUN_ID", "ANDRECOMP_NORMALIZED_SESSION_ID", "ANDRECOMP_RUNNER_INSTANCE_ID", "ANDRECOMP_RUNNER_BOOTSTRAP_TICKET", "ANDRECOMP_TASK_ID", "ANDRECOMP_APPROVAL_ID", "ANDRECOMP_APPROVAL_STATUS", "ANDRECOMP_LINKED_ISSUE_IDS",
  "ANDRECOMP_WAKE_REASON", "ANDRECOMP_WAKE_COMMENT_ID", "ANDRECOMP_WAKE_PAYLOAD_JSON", "ANDRECOMP_EXECUTION_MODE",
  "ANDRECOMP_WORKSPACES_JSON", "ANDRECOMP_WORKSPACE_ID", "ANDRECOMP_WORKSPACE_CWD", "ANDRECOMP_WORKSPACE_SOURCE",
  "ANDRECOMP_WORKSPACE_REPO_URL", "ANDRECOMP_WORKSPACE_REPO_REF", "ANDRECOMP_WORKSPACE_BRANCH",
  "ANDRECOMP_WORKSPACE_WORKTREE_PATH", "ANDRECOMP_WORKSPACE_REALIZATION_MODE", "ANDRECOMP_WORKSPACE_AUTHORITATIVE_ROOT",
  "ANDRECOMP_RUNTIME_PRIMARY_URL", "ANDRECOMP_RUNTIME_SERVICES_JSON", "ANDRECOMP_RUNTIME_SERVICE_INTENTS_JSON",
  "ANDRECOMP_AGENT_MESSAGE_KEY", "ANDRECOMP_HARNESS_CHECKOUT_KEY", "ANDRECOMP_EXTERNAL_CHAT_EXECUTION_BOUND_KEY",
  "ANDRECOMP_NATIVE_MCP_STDIO", "ANDRECOMP_NATIVE_MCP_PROXY",
  "ANDRECOMP_NATIVE_MCP_NAME", "ANDRECOMP_NATIVE_MCP_URL", "ANDRECOMP_NATIVE_MCP_TOKEN", "ANDRECOMP_AI_PROVIDER_KEY",
  "ANDRECOMP_PROVIDER_TRACE_PATH", "ANDRECOMP_PROVIDER_TRACE_MAX_BYTES", "ANDRECOMP_ACPX_CREDENTIAL_BINDING",
  "ANDRECOMP_RUNNER_NETWORK_ACCESS", "ANDRECOMP_RUNNER_NETWORK_ROOTS", "ANDRECOMP_RUNNER_EXTERNAL_SANDBOX",
  "ANDRECOMP_GITHUB_AUTH_MODE", "ANDRECOMP_GITHUB_HOST_HOME", "ANDRECOMP_GIT_METADATA_ROOTS",
  "ANDRECOMP_GITHUB_BROKER_TOKEN", "ANDRECOMP_GITHUB_BROKER_URL", "ANDRECOMP_GITHUB_BRIDGE_TOKEN", "ANDRECOMP_GITHUB_LAUNCHER_DIR",
]);

const RESERVED_KEYS = new Set([
  "PATH", "HOME", "USERPROFILE", "CODEX_HOME", "AGENT_HOME", "SHELL", "NODE_OPTIONS", "NODE_PATH",
  "PYTHONPATH", "PYTHONHOME", "RUBYOPT", "RUBYLIB", "PERL5OPT", "PERL5LIB", "BASH_ENV", "ENV", "ZDOTDIR", "GH_CONFIG_DIR",
  "OPENAI_API_KEY", "CODEX_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN",
  "AWS_BEARER_TOKEN_BEDROCK", "OPENROUTER_API_KEY", "XAI_API_KEY", "CURSOR_API_KEY", "CURSOR_AUTH_TOKEN",
  "COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN", "ANDRECOMP_GIT_TOKEN",
]);

function eligibleKey(key: string): boolean {
  const upper = key.toUpperCase();
  return /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)
    && !GENERATED_RUNTIME_ENVIRONMENT_KEYS.has(upper)
    && !RESERVED_KEYS.has(upper)
    && !/^(?:LD_|DYLD_|GIT_CONFIG_|ANDRECOMP_(?:RUNNER_|NATIVE_|GITHUB_|ACPX_|VERIFIED_))/.test(upper);
}

function checkedNames(names: unknown): string[] {
  if (!Array.isArray(names) || names.length > 128 || names.some(name => typeof name !== "string" || !eligibleKey(name))
    || new Set(names).size !== names.length) throw new Error("Invalid configured environment projection");
  return (names as string[]).sort();
}

/** Mint at the server's resolved configuration boundary, before host inheritance. */
export function configuredEnvironmentProjection(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const names = checkedNames(Object.keys(source).filter(key => source[key] !== undefined && eligibleKey(key)));
  return configuredEnvironment({ ...source, [CONFIGURED_ENVIRONMENT_KEYS]: JSON.stringify(names) });
}

/** Accept only an explicitly supplied, controller-minted projection. */
export function configuredEnvironment(source: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const raw = source?.[CONFIGURED_ENVIRONMENT_KEYS];
  if (raw === undefined) return {};
  if (Buffer.byteLength(raw) > 20_000) throw new Error("Invalid configured environment projection");
  let names: string[];
  try { names = checkedNames(JSON.parse(raw)); } catch { throw new Error("Invalid configured environment projection"); }
  const result: NodeJS.ProcessEnv = {};
  let bytes = 0;
  for (const name of names) {
    const value = source?.[name];
    if (typeof value !== "string" || value.includes("\0")) throw new Error("Invalid configured environment value");
    const size = Buffer.byteLength(name) + Buffer.byteLength(value);
    bytes += size;
    if (size > 65_536 || bytes > 262_144) throw new Error("Configured environment exceeds its bounded launch size");
    result[name] = value;
  }
  result[CONFIGURED_ENVIRONMENT_KEYS] = JSON.stringify(names);
  return result;
}

export function configuredEnvironmentKeys(source: NodeJS.ProcessEnv | undefined): string[] {
  return Object.keys(configuredEnvironment(source)).filter(key => key !== CONFIGURED_ENVIRONMENT_KEYS).sort();
}
