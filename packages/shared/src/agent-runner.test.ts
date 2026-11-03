import { describe, expect, it } from "vitest";
import { agentHarnessType, agentRuntimeSettingsHarness, andrecompRunnerProfileForHarness } from "./agent-runner.js";

describe("Cursor Cloud harness identity", () => {
  it("retains its cloud identity across the explicit runner selection", () => {
    expect(andrecompRunnerProfileForHarness("cursor_cloud")).toEqual({ provider: "cursor_cloud" });
    expect(agentHarnessType("andrecomp_runner", { provider: "cursor_cloud" })).toBe("cursor_cloud");
    expect(agentRuntimeSettingsHarness("andrecomp_runner", { provider: "cursor_cloud" })).toBe("cursor_cloud");
    expect(agentHarnessType("cursor_cloud")).toBe("cursor_cloud");
  });
});
