import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listKimiSkills,
  syncKimiSkills,
} from "@andrecomp/adapter-kimi-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("kimi local skill sync", () => {
  const andrecompKey = "TOSTES-LAB/Andre-009987Comp/andrecomp";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("defaults and installs the operational Andrecomp skill in the Kimi skills home", async () => {
    const kimiCodeHome = await makeTempDir("andrecomp-kimi-skill-sync-");
    cleanupDirs.add(kimiCodeHome);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "kimi_local",
      config: {
        env: {
          KIMI_CODE_HOME: kimiCodeHome,
        },
      },
    } as const;

    const before = await listKimiSkills(ctx);
    expect(before.adapterType).toBe("kimi_local");
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(andrecompKey);
    expect(before.entries.find((entry) => entry.key === andrecompKey)?.state).toBe("missing");

    const after = await syncKimiSkills(ctx, [andrecompKey]);
    expect(after.entries.find((entry) => entry.key === andrecompKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(kimiCodeHome, "skills", "andrecomp"))).isSymbolicLink()).toBe(true);
  });
});
