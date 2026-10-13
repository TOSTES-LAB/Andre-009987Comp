import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath } from "./home-paths.js";

const ANDRECOMP_CONFIG_BASENAME = "config.json";
const ANDRECOMP_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    const candidate = path.resolve(currentDir, ".andrecomp", ANDRECOMP_CONFIG_BASENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveAndrecompConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.ANDRECOMP_CONFIG) return path.resolve(process.env.ANDRECOMP_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolveAndrecompEnvPath(overrideConfigPath?: string): string {
  return path.resolve(path.dirname(resolveAndrecompConfigPath(overrideConfigPath)), ANDRECOMP_ENV_FILENAME);
}
