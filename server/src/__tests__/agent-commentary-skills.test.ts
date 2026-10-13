import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureCodexSkillsInjected, listCodexSkills } from "@andrecomp/adapter-codex-local/server";
import { listClaudeSkills } from "@andrecomp/adapter-claude-local/server";
import { readAndrecompRuntimeSkillEntries, resolveLegacyAndrecompDesiredSkillNames } from "@andrecomp/adapter-utils/server-utils";
import { prepareClaudePromptBundle } from "../../../packages/adapters/claude-local/src/server/prompt-cache.js";
import { stageCodexHomeForSync } from "../../../packages/adapters/codex-local/src/server/codex-home.js";

describe("default feedback skill delivery", () => {
  const cleanup: string[] = [];
  const keys = ["andrecomp", "complain", "suggestion-box"].map(name => `TOSTES-LAB/Andre-009987Comp/${name}`);
  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(cleanup.splice(0).map(root => rm(root, { recursive: true, force: true })));
  });

  it.each([undefined, []])("resolves defaults for Codex and Claude with selection %s", async (desiredSkills) => {
    const config = desiredSkills ? { andrecompSkillSync: { desiredSkills } } : {};
    for (const [adapterType, list] of [["codex_local", listCodexSkills], ["claude_local", listClaudeSkills]] as const) {
      const snapshot = await list({ agentId: "agent", companyId: "company", adapterType, config });
      expect(snapshot.desiredSkills).toEqual(expect.arrayContaining(keys));
      expect(snapshot.entries.filter(e => keys.includes(e.key)).every(e => e.state === "configured")).toBe(true);
    }
  });

  it("mounts both skills and their shared helper for Codex, Claude and the Codex sandbox home", async () => {
    const root = await mkdtemp(join(tmpdir(), "andrecomp-commentary-skills-"));
    cleanup.push(root);
    vi.stubEnv("ANDRECOMP_HOME", root);
    const entries = await readAndrecompRuntimeSkillEntries({}, import.meta.dirname, [fileURLToPath(new URL("../../../skills", import.meta.url))]);
    const desiredSkillNames = resolveLegacyAndrecompDesiredSkillNames({}, entries);
    const selected = entries.filter(e => desiredSkillNames.includes(e.key));
    const codexHome = join(root, "codex");
    await ensureCodexSkillsInjected(async () => {}, { skillsHome: join(codexHome, "skills"), skillsEntries: entries, desiredSkillNames });
    const claude = await prepareClaudePromptBundle({ companyId: "company", skills: selected, instructionsContents: null, onLog: async () => {} });
    const staged = await stageCodexHomeForSync(codexHome, { runId: "commentary-test" });
    cleanup.push(staged);
    for (const skills of [join(codexHome, "skills"), join(claude.addDir, ".claude", "skills"), join(staged, "skills")]) {
      for (const name of ["complain", "suggestion-box"]) {
        expect(await readFile(join(skills, name, "SKILL.md"), "utf8")).toContain("scripts/submit-agent-commentary.mjs");
      }
      expect(await readFile(join(skills, "andrecomp", "scripts", "submit-agent-commentary.mjs"), "utf8")).toContain("process.stdin");
    }
    // Runtime policy removes entries before default selection; never resurrect them.
    const restricted = entries.filter(e => e.key === keys[0]);
    expect(resolveLegacyAndrecompDesiredSkillNames({}, restricted)).toEqual([keys[0]]);
    expect(await readAndrecompRuntimeSkillEntries({ andrecompRuntimeSkills: [] }, import.meta.dirname)).toEqual([]);
  });
});
