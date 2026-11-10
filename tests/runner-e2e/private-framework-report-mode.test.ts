import { afterEach, expect, it, vi } from "vitest";
import { buildRunnerE2EProcessEnvironment } from "./harness-env.js";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it.each([
  [undefined, undefined, ["list", "blob", "junit", "html"]],
  ["/tmp/owned/preflight.json", undefined, ["list", "blob", "junit", "html"]],
  [undefined, "v1", ["list", "blob", "junit", "html"]],
  ["/tmp/owned/preflight.json", "v1", ["list", "json", "junit"]],
] as const)("selects supported private reporter mode for preflight=%s/TestOps=%s", async (preflight, testops, expected) => {
  const source = { ANDRECOMP_RUNNER_E2E_PRIVATE_PREFLIGHT: preflight, ANDRECOMP_CHAT_COMPLETION_TESTOPS: testops };
  expect(buildRunnerE2EProcessEnvironment(source, []).ANDRECOMP_CHAT_COMPLETION_TESTOPS).toBe(testops);
  for (const [key, value] of Object.entries({ ...source, ANDRECOMP_RUNNER_E2E_PORT: "3104", ANDRECOMP_RUNNER_E2E_TEMP_ROOT: "/tmp/owned", ANDRECOMP_RUNNER_E2E_PRIVATE_DIR: "/tmp/owned/private",
    ANDRECOMP_HOME: "/tmp/owned/home", ANDRECOMP_CONFIG: "/tmp/owned/config.json", ANDRECOMP_INSTANCE_ID: "synthetic", ANDRECOMP_AGENT_JWT_SECRET: "synthetic", ANDRECOMP_DECISION_SIGNING_SECRET: "synthetic", ANDRECOMP_TOOL_ACTION_SIGNING_SECRET: "synthetic", BETTER_AUTH_SECRET: "synthetic" })) vi.stubEnv(key, value);
  const { default: config } = await import("./playwright.config.js");
  expect((config.reporter as Array<[string]>).map(row => row[0])).toEqual(expected);
});
