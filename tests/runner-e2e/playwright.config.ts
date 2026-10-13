import path from "node:path";
import { defineConfig } from "@playwright/test";
import {
  runnerE2EWebServerCommand,
  runnerE2EWebServerGracefulShutdown,
} from "./web-server-command.js";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const port = Number(required("ANDRECOMP_RUNNER_E2E_PORT"));
const temporaryRoot = required("ANDRECOMP_RUNNER_E2E_TEMP_ROOT");
const privateDir = required("ANDRECOMP_RUNNER_E2E_PRIVATE_DIR");
const andrecompHome = required("ANDRECOMP_HOME");
const configPath = required("ANDRECOMP_CONFIG");
const baseURL = `http://127.0.0.1:${port}`;
const playwrightChannel = process.env.ANDRECOMP_PLAYWRIGHT_CHANNEL?.trim();
const chromiumExecutable =
  process.env.ANDRECOMP_RUNNER_E2E_CHROMIUM_EXECUTABLE?.trim();
if (playwrightChannel && chromiumExecutable) {
  throw new Error(
    "ANDRECOMP_PLAYWRIGHT_CHANNEL and ANDRECOMP_RUNNER_E2E_CHROMIUM_EXECUTABLE are mutually exclusive",
  );
}
if (chromiumExecutable && !path.isAbsolute(chromiumExecutable)) {
  throw new Error(
    "ANDRECOMP_RUNNER_E2E_CHROMIUM_EXECUTABLE must be an absolute path",
  );
}
required("ANDRECOMP_INSTANCE_ID");
required("ANDRECOMP_AGENT_JWT_SECRET");
required("ANDRECOMP_DECISION_SIGNING_SECRET");
required("ANDRECOMP_TOOL_ACTION_SIGNING_SECRET");
required("BETTER_AUTH_SECRET");
if (
  !andrecompHome.startsWith(`${temporaryRoot}${path.sep}`) ||
  !configPath.startsWith(`${temporaryRoot}${path.sep}`)
) {
  throw new Error("Andrecomp server paths escape the isolated temporary root");
}
const repositoryRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: ".",
  testMatch: process.env.ANDRECOMP_RUNNER_E2E_INSTALLED_STARTUP_ONLY === "1" ? "installed-startup.spec.ts" : "runner.spec.ts",
  timeout: Number(process.env.ANDRECOMP_RUNNER_E2E_TEST_TIMEOUT_MS ?? 600_000),
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    browserName: "chromium",
    ...(playwrightChannel ? { channel: playwrightChannel } : {}),
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    screenshot: process.env.ANDRECOMP_RUNNER_E2E_PUBLIC_MCP === "1" ? "off" : "only-on-failure",
    trace: process.env.ANDRECOMP_RUNNER_E2E_PUBLIC_MCP === "1" ? "off" : "retain-on-failure",
    // A developer-supplied system Chromium keeps the local smoke loop
    // installation-free; CI's managed browser retains failure video as usual.
    video: chromiumExecutable || process.env.ANDRECOMP_RUNNER_E2E_PUBLIC_MCP === "1" ? "off" : "retain-on-failure",
  },
  webServer: {
    // Do not put an env object here: Playwright serializes webServer config in
    // blob reports. The wrapper inherits the test process and strips provider
    // keys before spawning the real Andrecomp process.
    command: runnerE2EWebServerCommand(repositoryRoot),
    gracefulShutdown: runnerE2EWebServerGracefulShutdown,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    // Fresh databases apply the complete migration history before health is ready.
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  outputDir: path.join(privateDir, "playwright-output"),
  reporter: [
    ["list"],
    ["blob", { outputDir: path.join(privateDir, "blob-report") }],
    ["junit", { outputFile: path.join(privateDir, "junit.xml") }],
    [
      "html",
      { open: "never", outputFolder: path.join(privateDir, "html-report") },
    ],
  ],
});
