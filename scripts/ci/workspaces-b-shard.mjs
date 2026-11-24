// Duration-weighted project sharding for `general-workspaces-b`.
// Measured weights (ms, batched multi-project Vitest run on 4-core runners):
// `@andrecomp/adapter-utils` (~2,146 tests, ~135s) dominates the 17-project
// lane and equals the combined batched runtime of the remaining 16 packages
// (~133s), so a 2-shard LPT split naturally balances ~2.2m per shard.
export const DEFAULT_WORKSPACE_PROJECT_WEIGHT_MS = 10_000;

export const WORKSPACES_B_PROJECT_DURATIONS_MS = Object.freeze({
  "@andrecomp/adapter-utils": 135_000,
  "@andrecomp/plugin-daytona": 34_000,
  "@andrecomp/adapter-claude-local": 20_000,
  "@andrecomp/adapter-codex-local": 17_500,
  "@andrecomp/adapter-gemini-local": 8_800,
  "@andrecomp/hermes-andrecomp-adapter": 7_900,
  "@andrecomp/adapter-grok-local": 7_400,
  "@andrecomp/shared": 6_500,
  "@andrecomp/plugin-sdk": 6_000,
  "@andrecomp/adapter-opencode-local": 5_100,
  "@andrecomp/adapter-kimi-local": 5_000,
  "@andrecomp/adapter-openclaw-gateway": 4_100,
  "@andrecomp/adapter-cursor-local": 4_000,
  "@andrecomp/adapter-pi-local": 2_300,
  "@andrecomp/adapter-cursor-cloud": 2_300,
  "@andrecomp/skills-catalog": 1_600,
  "@andrecomp/create-andrecomp-plugin": 700,
});

function projectWeight(project, weights) {
  const value = weights?.[project];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_WORKSPACE_PROJECT_WEIGHT_MS;
}

export function partitionWorkspaceProjects(
  projects,
  shardCount,
  weights = WORKSPACES_B_PROJECT_DURATIONS_MS,
) {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new Error(`shardCount must be a positive integer. Received "${shardCount}".`);
  }
  const shards = Array.from({ length: shardCount }, (_, index) => ({
    index,
    projects: [],
    totalWeight: 0,
  }));
  const weighted = projects
    .map((project, order) => ({
      project,
      order,
      weight: projectWeight(project, weights),
    }))
    .sort((a, b) => b.weight - a.weight || a.project.localeCompare(b.project));

  for (const item of weighted) {
    let target = shards[0];
    for (let i = 1; i < shards.length; i += 1) {
      const candidate = shards[i];
      if (
        candidate.totalWeight < target.totalWeight ||
        (candidate.totalWeight === target.totalWeight && candidate.projects.length < target.projects.length)
      ) {
        target = candidate;
      }
    }
    target.projects.push(item);
    target.totalWeight += item.weight;
  }

  return shards.map((shard) => ({
    index: shard.index,
    projects: shard.projects.sort((a, b) => a.order - b.order).map((item) => item.project),
    totalWeight: shard.totalWeight,
  }));
}

export function selectWorkspaceProjectsShard(
  projects,
  shardIndex,
  shardCount,
  weights = WORKSPACES_B_PROJECT_DURATIONS_MS,
) {
  if (shardCount === null || shardCount === undefined || shardCount <= 1) {
    return [...projects];
  }
  if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error(`shardIndex must be in [0, ${shardCount}). Received "${shardIndex}".`);
  }
  return partitionWorkspaceProjects(projects, shardCount, weights)[shardIndex].projects;
}
