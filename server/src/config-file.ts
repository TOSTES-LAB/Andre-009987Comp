import fs from "node:fs";
import {
  DEPLOYMENT_MODES,
  findAndrecompConfigKeyWarnings,
  andrecompConfigSchema,
  type AndrecompConfig,
  type DeploymentMode,
} from "@andrecomp/shared";
import { ZodError } from "zod";
import { resolveAndrecompConfigPath } from "./paths.js";
import { isCloudManagedInstance } from "./services/cloud-instance.js";
import { getCloudRuntimeConfigSnapshot, toAndrecompConfig } from "./services/cloud-runtime-config-snapshot.js";

function formatConfigValidationError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const issuePath = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${issuePath}: ${issue.message}`;
    })
    .join("; ");
}

export function readConfigFile(): AndrecompConfig | null {
  if (isCloudManagedInstance()) return toAndrecompConfig(getCloudRuntimeConfigSnapshot().config);
  const configPath = resolveAndrecompConfigPath();

  if (!fs.existsSync(configPath)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid Andrecomp config at ${configPath}: failed to read or parse JSON: ${reason}`);
  }

  try {
    const config = andrecompConfigSchema.parse(raw);
    for (const warning of findAndrecompConfigKeyWarnings(config)) {
      console.warn(
        `Unknown config key ${warning.path}; did you mean ${warning.suggestion}? It will be preserved.`,
      );
    }
    return config;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Invalid Andrecomp config at ${configPath}: ${formatConfigValidationError(error)}`);
    }

    throw error;
  }
}

/** Resolve the same deployment mode without loading config.ts's dotenv/startup side effects. */
export function resolveDeploymentMode(fileConfig = readConfigFile()): DeploymentMode {
  const fromEnv = process.env.ANDRECOMP_DEPLOYMENT_MODE;
  return fromEnv && DEPLOYMENT_MODES.includes(fromEnv as DeploymentMode)
    ? fromEnv as DeploymentMode
    : fileConfig?.server.deploymentMode ?? "local_trusted";
}
