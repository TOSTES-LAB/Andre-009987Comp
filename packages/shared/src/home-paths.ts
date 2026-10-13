import os from "node:os";
import path from "node:path";

export const DEFAULT_ANDRECOMP_INSTANCE_ID = "default";
export const ANDRECOMP_CONFIG_BASENAME = "config.json";
export const ANDRECOMP_ENV_FILENAME = ".env";

const PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

export function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function resolveAndrecompHomeDir(homeOverride?: string): string {
  const raw = homeOverride?.trim() || process.env.ANDRECOMP_HOME?.trim();
  if (raw) return path.resolve(expandHomePrefix(raw));
  return path.resolve(os.homedir(), ".andrecomp");
}

export function resolveAndrecompInstanceId(instanceIdOverride?: string): string {
  const raw = instanceIdOverride?.trim() || process.env.ANDRECOMP_INSTANCE_ID?.trim() || DEFAULT_ANDRECOMP_INSTANCE_ID;
  if (!PATH_SEGMENT_RE.test(raw)) {
    throw new Error(`Invalid ANDRECOMP_INSTANCE_ID '${raw}'.`);
  }
  return raw;
}

export function resolveAndrecompInstanceRoot(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveAndrecompHomeDir(input.homeDir), "instances", resolveAndrecompInstanceId(input.instanceId));
}

export function resolveAndrecompInstanceConfigPath(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveAndrecompInstanceRoot(input), ANDRECOMP_CONFIG_BASENAME);
}

export function resolveAndrecompConfigPathForInstance(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return resolveAndrecompInstanceConfigPath(input);
}

export function resolveAndrecompEnvPathForConfig(configPath: string): string {
  return path.resolve(path.dirname(configPath), ANDRECOMP_ENV_FILENAME);
}

export function resolveDefaultEmbeddedPostgresDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveAndrecompInstanceRoot(input), "db");
}

export function resolveDefaultLogsDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveAndrecompInstanceRoot(input), "logs");
}

export function resolveDefaultSecretsKeyFilePath(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveAndrecompInstanceRoot(input), "secrets", "master.key");
}

export function resolveDefaultStorageDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveAndrecompInstanceRoot(input), "data", "storage");
}

export function resolveDefaultBackupDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveAndrecompInstanceRoot(input), "data", "backups");
}

export function resolveHomeAwarePath(value: string): string {
  return path.resolve(expandHomePrefix(value));
}
