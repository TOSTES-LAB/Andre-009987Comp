import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bootstrapDevRunnerWorktreeEnv,
  applyEmptyWorktreeSigningSecrets,
  isWorktreeSeedPending,
  isLinkedGitWorktreeCheckout,
  resolveWorktreeEnvFilePath,
} from "../dev-runner-worktree.ts";

const tempRoots = new Set<string>();

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.add(root);
  return root;
}

describe("dev-runner worktree env bootstrap", () => {
  it("uses saved empty-instance signing keys instead of inherited source keys", () => {
    const root = createTempRoot("andrecomp-empty-signing-keys-");
    fs.mkdirSync(path.join(root, ".andrecomp"));
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/andrecomp/.git/worktrees/empty\n");
    fs.writeFileSync(path.join(root, ".andrecomp", "seed-empty"), "explicitly empty\n");
    fs.writeFileSync(resolveWorktreeEnvFilePath(root), 'ANDRECOMP_AGENT_JWT_SECRET="fresh-jwt"\nANDRECOMP_TOOL_ACTION_SIGNING_SECRET="fresh-actions"\n');
    const env = { ANDRECOMP_AGENT_JWT_SECRET: "source-jwt", ANDRECOMP_TOOL_ACTION_SIGNING_SECRET: "source-actions", BETTER_AUTH_SECRET: "source-auth" };
    bootstrapDevRunnerWorktreeEnv(root, env);
    expect(env).toMatchObject({ ANDRECOMP_AGENT_JWT_SECRET: "fresh-jwt", ANDRECOMP_TOOL_ACTION_SIGNING_SECRET: "fresh-actions", BETTER_AUTH_SECRET: "fresh-jwt" });
    fs.writeFileSync(resolveWorktreeEnvFilePath(root), 'ANDRECOMP_AGENT_JWT_SECRET="fresh-jwt"\n');
    expect(() => applyEmptyWorktreeSigningSecrets(root, env)).toThrow("missing its saved ANDRECOMP_TOOL_ACTION_SIGNING_SECRET");
  });
  it("guards seed-pending worktrees until a seed-complete marker exists", () => {
    const root = createTempRoot("andrecomp-dev-runner-seed-pending-");
    fs.mkdirSync(path.join(root, ".andrecomp"), { recursive: true });
    fs.writeFileSync(path.join(root, ".andrecomp", "seed-pending"), "{}\n", "utf8");

    expect(isWorktreeSeedPending(root)).toBe(true);

    fs.writeFileSync(path.join(root, ".andrecomp", "seed-complete"), "{}\n", "utf8");
    expect(isWorktreeSeedPending(root)).toBe(false);
  });

  it("guards every manifest state except a complete verified manifest", () => {
    const root = createTempRoot("andrecomp-dev-runner-seed-manifest-");
    const manifestPath = path.join(root, ".andrecomp", "seed-manifest.json");
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({ version: 2, state: "failed" }), "utf8");
    expect(isWorktreeSeedPending(root)).toBe(true);

    fs.writeFileSync(manifestPath, JSON.stringify({ version: 2, state: "verified" }), "utf8");
    expect(isWorktreeSeedPending(root)).toBe(true);

    fs.writeFileSync(manifestPath, JSON.stringify({
      version: 2,
      source: { instanceId: "source", configPath: "/source/config.json" },
      snapshotAt: "2026-08-18T00:00:00.000Z",
      seedMode: "minimal",
      migrationRevision: "0001",
      targetInstanceId: "target",
      phase: "complete",
      state: "verified",
      attemptId: "attempt",
      startedAt: "2026-08-18T00:00:00.000Z",
      finishedAt: "2026-08-18T00:01:00.000Z",
      diagnostics: [{ phase: "complete", status: "succeeded", at: "2026-08-18T00:01:00.000Z" }],
    }), "utf8");
    expect(isWorktreeSeedPending(root)).toBe(false);

    fs.writeFileSync(manifestPath, "not-json", "utf8");
    expect(isWorktreeSeedPending(root)).toBe(true);
  });

  it("detects linked git worktrees from .git files", () => {
    const root = createTempRoot("andrecomp-dev-runner-worktree-");
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/andrecomp/.git/worktrees/feature\n", "utf8");

    expect(isLinkedGitWorktreeCheckout(root)).toBe(true);
  });

  it("loads repo-local Andrecomp env for initialized worktrees without overriding explicit env", () => {
    const root = createTempRoot("andrecomp-dev-runner-worktree-env-");
    fs.mkdirSync(path.join(root, ".andrecomp"), { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/andrecomp/.git/worktrees/feature\n", "utf8");
    fs.writeFileSync(
      resolveWorktreeEnvFilePath(root),
      [
        "ANDRECOMP_HOME=/tmp/andrecomp-worktrees",
        "ANDRECOMP_INSTANCE_ID=feature-worktree",
        "ANDRECOMP_IN_WORKTREE=true",
        "ANDRECOMP_WORKTREE_NAME=feature-worktree",
        "ANDRECOMP_OPTIONAL= # comment-only value",
        "",
      ].join("\n"),
      "utf8",
    );

    const env: NodeJS.ProcessEnv = {
      ANDRECOMP_INSTANCE_ID: "already-set",
    };
    const result = bootstrapDevRunnerWorktreeEnv(root, env);

    expect(result).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: false,
    });
    expect(env.ANDRECOMP_HOME).toBe("/tmp/andrecomp-worktrees");
    expect(env.ANDRECOMP_INSTANCE_ID).toBe("already-set");
    expect(env.ANDRECOMP_IN_WORKTREE).toBe("true");
    expect(env.ANDRECOMP_OPTIONAL).toBe("");
  });

  it("repairs stale migrated config paths before loading worktree env", () => {
    const root = createTempRoot("andrecomp-dev-runner-worktree-migrated-env-");
    const localConfigPath = path.join(root, ".andrecomp", "config.json");
    const worktreesDir = path.join(root, ".andrecomp-worktrees");
    fs.mkdirSync(path.dirname(localConfigPath), { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/andrecomp/.git/worktrees/feature\n", "utf8");
    fs.writeFileSync(localConfigPath, "{}\n", "utf8");
    fs.writeFileSync(
      resolveWorktreeEnvFilePath(root),
      [
        "ANDRECOMP_HOME=/old/home/.andrecomp-worktrees",
        "ANDRECOMP_INSTANCE_ID=feature-worktree",
        "ANDRECOMP_CONFIG=/old/home/andrecomp/.andrecomp/worktrees/feature/.andrecomp/config.json",
        "ANDRECOMP_CONTEXT=/old/home/.andrecomp-worktrees/context.json",
        "ANDRECOMP_IN_WORKTREE=true",
        "ANDRECOMP_WORKTREE_NAME=feature-worktree",
        "",
      ].join("\n"),
      "utf8",
    );

    const env: NodeJS.ProcessEnv = {
      ANDRECOMP_WORKTREES_DIR: worktreesDir,
    };
    const result = bootstrapDevRunnerWorktreeEnv(root, env);

    expect(result).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: false,
    });
    expect(env.ANDRECOMP_HOME).toBe(worktreesDir);
    expect(env.ANDRECOMP_CONFIG).toBe(localConfigPath);
    expect(env.ANDRECOMP_CONTEXT).toBe(path.join(worktreesDir, "context.json"));
    expect(env.ANDRECOMP_INSTANCE_ID).toBe("feature-worktree");
  });

  it("reports uninitialized linked worktrees so dev runner can fail fast", () => {
    const root = createTempRoot("andrecomp-dev-runner-worktree-missing-");
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/andrecomp/.git/worktrees/feature\n", "utf8");

    expect(bootstrapDevRunnerWorktreeEnv(root, {})).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: true,
    });
  });
});
