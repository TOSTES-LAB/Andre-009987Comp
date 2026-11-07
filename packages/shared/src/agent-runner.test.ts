import { describe, expect, it } from "vitest";
import { agentHarnessType, agentRuntimeSettingsHarness, andrecompRunnerCreationLifecycle, andrecompRunnerProfileForHarness } from "./agent-runner.js";

describe("Cursor Cloud harness identity", () => {
  it("retains its cloud identity across the explicit runner selection", () => {
    expect(andrecompRunnerProfileForHarness("cursor_cloud")).toEqual({ provider: "cursor_cloud" });
    expect(agentHarnessType("andrecomp_runner", { provider: "cursor_cloud" })).toBe("cursor_cloud");
    expect(agentRuntimeSettingsHarness("andrecomp_runner", { provider: "cursor_cloud" })).toBe("cursor_cloud");
    expect(agentHarnessType("cursor_cloud")).toBe("cursor_cloud");
  });
});

describe("andrecompRunnerCreationLifecycle", () => {
  it("stores no lifecycle for harnesses that follow the product default", () => {
    for (const harness of ["codex_local", "opencode_local", "claude_local"]) {
      expect(andrecompRunnerCreationLifecycle(andrecompRunnerProfileForHarness(harness)!)).toEqual({});
    }
  });

  it("keeps an explicit per_turn for other native harnesses", () => {
    for (const harness of ["pi_local", "grok_local", "cursor_cloud"]) {
      expect(andrecompRunnerCreationLifecycle(andrecompRunnerProfileForHarness(harness)!)).toEqual({ lifecycleMode: "per_turn" });
    }
  });
});
