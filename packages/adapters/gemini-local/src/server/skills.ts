import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AdapterSkillContext,
  AdapterSkillSnapshot,
} from "@andrecomp/adapter-utils";
import {
  buildPersistentSkillSnapshot,
  ensureAndrecompSkillSymlink,
  readAndrecompRuntimeSkillEntries,
  readInstalledSkillTargets,
  resolveLegacyAndrecompDesiredSkillNames,
} from "@andrecomp/adapter-utils/server-utils";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function resolveGeminiSkillsHome(config: Record<string, unknown>) {
  const env =
    typeof config.env === "object" && config.env !== null && !Array.isArray(config.env)
      ? (config.env as Record<string, unknown>)
      : {};
  const configuredHome = asString(env.HOME);
  const home = configuredHome ? path.resolve(configuredHome) : os.homedir();
  return path.join(home, ".gemini", "skills");
}

async function buildGeminiSkillSnapshot(config: Record<string, unknown>): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readAndrecompRuntimeSkillEntries(config, __moduleDir);
  const desiredSkills = resolveLegacyAndrecompDesiredSkillNames(config, availableEntries);
  const skillsHome = resolveGeminiSkillsHome(config);
  const installed = await readInstalledSkillTargets(skillsHome);
  return buildPersistentSkillSnapshot({
    adapterType: "gemini_local",
    availableEntries,
    desiredSkills,
    installed,
    skillsHome,
    locationLabel: "~/.gemini/skills",
    missingDetail: "Configured but not currently linked into the Gemini skills home.",
    externalConflictDetail: "Skill name is occupied by an external installation.",
    externalDetail: "Installed outside Andrecomp management.",
  });
}

export async function listGeminiSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot> {
  return buildGeminiSkillSnapshot(ctx.config);
}

export async function syncGeminiSkills(
  ctx: AdapterSkillContext,
  desiredSkills: string[],
): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readAndrecompRuntimeSkillEntries(ctx.config, __moduleDir);
  const desiredSet = new Set([
    ...resolveLegacyAndrecompDesiredSkillNames({}, availableEntries),
    ...desiredSkills,
  ]);
  const skillsHome = resolveGeminiSkillsHome(ctx.config);
  await fs.mkdir(skillsHome, { recursive: true });
  const installed = await readInstalledSkillTargets(skillsHome);
  const availableByRuntimeName = new Map(availableEntries.map((entry) => [entry.runtimeName, entry]));

  for (const available of availableEntries) {
    if (!desiredSet.has(available.key)) continue;
    const target = path.join(skillsHome, available.runtimeName);
    await ensureAndrecompSkillSymlink(available.source, target);
  }

  for (const [name, installedEntry] of installed.entries()) {
    const available = availableByRuntimeName.get(name);
    if (!available) continue;
    if (desiredSet.has(available.key)) continue;
    if (installedEntry.targetPath !== available.source) continue;
    await fs.unlink(path.join(skillsHome, name)).catch(() => {});
  }

  return buildGeminiSkillSnapshot(ctx.config);
}

export function resolveGeminiDesiredSkillNames(
  config: Record<string, unknown>,
  availableEntries: Array<{ key: string }>,
) {
  return resolveLegacyAndrecompDesiredSkillNames(config, availableEntries);
}
