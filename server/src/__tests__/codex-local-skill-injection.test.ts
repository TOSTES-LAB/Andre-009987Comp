import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexSkillsInjected } from "@andrecomp/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createAndrecompRepoSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "server"), { recursive: true });
  await fs.mkdir(path.join(root, "packages", "adapter-utils"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", skillName), { recursive: true });
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  await fs.writeFile(path.join(root, "package.json"), '{"name":"andrecomp"}\n', "utf8");
  await fs.writeFile(
    path.join(root, "skills", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

async function createCustomSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "custom", skillName), { recursive: true });
  await fs.writeFile(
    path.join(root, "custom", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

describe("codex local adapter skill injection", () => {
  const andrecompKey = "TOSTES-LAB/Andre-009987Comp/andrecomp";
  const createAgentKey = "TOSTES-LAB/Andre-009987Comp/andrecomp-create-agent";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("repairs a Codex Andrecomp skill symlink that still points at another live checkout", async () => {
    const currentRepo = await makeTempDir("andrecomp-codex-current-");
    const oldRepo = await makeTempDir("andrecomp-codex-old-");
    const skillsHome = await makeTempDir("andrecomp-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createAndrecompRepoSkill(currentRepo, "andrecomp");
    await createAndrecompRepoSkill(currentRepo, "andrecomp-create-agent");
    await createAndrecompRepoSkill(oldRepo, "andrecomp");
    await fs.symlink(path.join(oldRepo, "skills", "andrecomp"), path.join(skillsHome, "andrecomp"));

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [
          {
            key: andrecompKey,
            runtimeName: "andrecomp",
            source: path.join(currentRepo, "skills", "andrecomp"),
          },
          {
            key: createAgentKey,
            runtimeName: "andrecomp-create-agent",
            source: path.join(currentRepo, "skills", "andrecomp-create-agent"),
          },
        ],
      },
    );

    expect(await fs.realpath(path.join(skillsHome, "andrecomp"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "andrecomp")),
    );
    expect(await fs.realpath(path.join(skillsHome, "andrecomp-create-agent"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "andrecomp-create-agent")),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Repaired Codex skill "andrecomp"'),
      }),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Injected Codex skill "andrecomp-create-agent"'),
      }),
    );
  });

  it("preserves a custom Codex skill symlink outside Andrecomp repo checkouts", async () => {
    const currentRepo = await makeTempDir("andrecomp-codex-current-");
    const customRoot = await makeTempDir("andrecomp-codex-custom-");
    const skillsHome = await makeTempDir("andrecomp-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(customRoot);
    cleanupDirs.add(skillsHome);

    await createAndrecompRepoSkill(currentRepo, "andrecomp");
    await createCustomSkill(customRoot, "andrecomp");
    await fs.symlink(path.join(customRoot, "custom", "andrecomp"), path.join(skillsHome, "andrecomp"));

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: andrecompKey,
        runtimeName: "andrecomp",
        source: path.join(currentRepo, "skills", "andrecomp"),
      }],
    });

    expect(await fs.realpath(path.join(skillsHome, "andrecomp"))).toBe(
      await fs.realpath(path.join(customRoot, "custom", "andrecomp")),
    );
  });

  it("prunes broken symlinks for unavailable Andrecomp repo skills before Codex starts", async () => {
    const currentRepo = await makeTempDir("andrecomp-codex-current-");
    const oldRepo = await makeTempDir("andrecomp-codex-old-");
    const skillsHome = await makeTempDir("andrecomp-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createAndrecompRepoSkill(currentRepo, "andrecomp");
    await createAndrecompRepoSkill(oldRepo, "agent-browser");
    const staleTarget = path.join(oldRepo, "skills", "agent-browser");
    await fs.symlink(staleTarget, path.join(skillsHome, "agent-browser"));
    await fs.rm(staleTarget, { recursive: true, force: true });

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: andrecompKey,
          runtimeName: "andrecomp",
          source: path.join(currentRepo, "skills", "andrecomp"),
        }],
      },
    );

    await expect(fs.lstat(path.join(skillsHome, "agent-browser"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Removed stale Codex skill "agent-browser"'),
      }),
    );
  });

  it("preserves other live Andrecomp skill symlinks in the shared workspace skill directory", async () => {
    const currentRepo = await makeTempDir("andrecomp-codex-current-");
    const skillsHome = await makeTempDir("andrecomp-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(skillsHome);

    await createAndrecompRepoSkill(currentRepo, "andrecomp");
    await createAndrecompRepoSkill(currentRepo, "agent-browser");
    await fs.symlink(
      path.join(currentRepo, "skills", "agent-browser"),
      path.join(skillsHome, "agent-browser"),
    );

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: andrecompKey,
        runtimeName: "andrecomp",
        source: path.join(currentRepo, "skills", "andrecomp"),
      }],
    });

    expect((await fs.lstat(path.join(skillsHome, "andrecomp"))).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(path.join(skillsHome, "agent-browser"))).isSymbolicLink()).toBe(true);
    expect(await fs.realpath(path.join(skillsHome, "agent-browser"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "agent-browser")),
    );
  });
});
