import { AGENT_OBSERVABILITY_ENV_KEYS } from "./agent-observability.js";

const SECRET_NAME = /key|secret|token/i;
const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PROVIDER_ONLY_KEYS: ReadonlySet<string> = new Set([
  "OPENAI_API_KEY", "CODEX_API_KEY", "ANDRECOMP_AI_PROVIDER_KEY",
  ...AGENT_OBSERVABILITY_ENV_KEYS,
]);
const IDENTITY_KEYS = ["ANDRECOMP_AGENT_KEY_ID", "ANDRECOMP_AGENT_PUBLIC_KEY", "ANDRECOMP_AGENT_PRIVATE_KEY"];

/** Only resolved adapter configuration can opt a service secret into shell access.
 * The launch environment here is Andrecomp-built, never ambient process.env.
 * Return names only: values must stay out of provider config and argv.
 */
export function codexShellEnvironmentKeys(
  environment: Record<string, string>,
  configuredEnvironment: Record<string, unknown>,
  hasAgentIdentity: boolean,
): string[] {
  const configuredSecrets = new Set(Object.entries(configuredEnvironment)
    .filter(([key, value]) => ENVIRONMENT_NAME.test(key) && typeof value === "string" && typeof environment[key] === "string"
      && !/^ANDRECOMP_(?:GITHUB_|RUNNER_|NATIVE_|ACPX_)/i.test(key)
      && SECRET_NAME.test(key) && !PROVIDER_ONLY_KEYS.has(key.toUpperCase()))
    .map(([key]) => key));
  return [...new Set([
    "PATH", "HOME", "LANG", "LANGUAGE", "LC_ALL", "LC_CTYPE", "TZ", "TMPDIR", "TEMP", "TMP", "CODEX_HOME",
    ...Object.keys(environment).filter(key => ENVIRONMENT_NAME.test(key) && !PROVIDER_ONLY_KEYS.has(key.toUpperCase())
      && (key === "ANDRECOMP_API_KEY" || configuredSecrets.has(key) || !SECRET_NAME.test(key))),
    ...(hasAgentIdentity ? IDENTITY_KEYS : []),
  ])].sort();
}
