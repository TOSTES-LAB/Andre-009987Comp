import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listOpenCodeSkills,
  syncOpenCodeSkills,
} from "@andrecomp/adapter-opencode-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("opencode local skill sync", () => {
  const andrecompKey = "TOSTES-LAB/Andre-009987Comp/andrecomp";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("defaults and installs the operational Andrecomp skill in the shared Claude/OpenCode skills home", async () => {
    const home = await makeTempDir("andrecomp-opencode-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "opencode_local",
      config: {
        env: {
          HOME: home,
        },
      },
    } as const;

    const before = await listOpenCodeSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.warnings).toContain("OpenCode currently uses the shared Claude skills home (~/.claude/skills).");
    expect(before.desiredSkills).toContain(andrecompKey);
    expect(before.entries.find((entry) => entry.key === andrecompKey)?.state).toBe("missing");

    const after = await syncOpenCodeSkills(ctx, [andrecompKey]);
    expect(after.entries.find((entry) => entry.key === andrecompKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".claude", "skills", "andrecomp"))).isSymbolicLink()).toBe(true);
  });
});
