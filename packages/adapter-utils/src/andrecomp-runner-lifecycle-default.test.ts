import { describe, expect, it } from "vitest";
import { andrecompRunnerTransitionConfig } from "./andrecomp-runner-permissions.js";
import { normalizeAndrecompRunnerAdapterConfig } from "./server-utils.js";

const normalize = (config: Record<string, unknown>) => normalizeAndrecompRunnerAdapterConfig("andrecomp_runner", config);

describe("native runner lifecycle default on configuration writes", () => {
  it("stores no lifecycle for providers that follow the product default", () => {
    for (const config of [{ provider: "codex" }, { provider: "opencode", model: "openrouter/m" }, { provider: "acpx", acpxAgent: "claude" }, {}]) {
      // An empty config defaults to native Codex.
      expect(normalize(config)).not.toHaveProperty("lifecycleMode");
    }
  });

  it("keeps an explicit per_turn for other native providers", () => {
    for (const config of [{ provider: "acpx", acpxAgent: "grok" }, { provider: "acpx", acpxAgent: "pi" }, { provider: "cursor_cloud" }]) {
      expect(normalize(config)).toMatchObject({ lifecycleMode: "per_turn" });
    }
  });

  it("preserves an explicit choice", () => {
    expect(normalize({ provider: "codex", lifecycleMode: "per_turn" })).toMatchObject({ lifecycleMode: "per_turn" });
    expect(normalize({ provider: "opencode", model: "openrouter/m", lifecycleMode: "warm", idleTimeoutMs: 900_000 }))
      .toMatchObject({ lifecycleMode: "warm", idleTimeoutMs: 900_000 });
  });

  it("converts a local adapter without pinning the lifecycle for default providers", () => {
    expect(andrecompRunnerTransitionConfig("codex_local", "gpt-5")).not.toHaveProperty("lifecycleMode");
    expect(andrecompRunnerTransitionConfig("opencode_local", "openrouter/m")).not.toHaveProperty("lifecycleMode");
    expect(andrecompRunnerTransitionConfig("claude_local", undefined)).not.toHaveProperty("lifecycleMode");
    expect(andrecompRunnerTransitionConfig("grok_local", undefined)).toMatchObject({ lifecycleMode: "per_turn" });
    expect(andrecompRunnerTransitionConfig("cursor_cloud", "m")).toMatchObject({ lifecycleMode: "per_turn" });
  });
});
