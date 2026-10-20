import { resolveAndrecompRunnerPiThinkingLevel } from "./andrecomp-runner-permissions.js";
import { describe, expect, it } from "vitest";

import {
  ANDRECOMP_RUNNER_DEFAULT_MODELS,
  ANDRECOMP_RUNNER_ACPX_PROFILES,
  andrecompRunnerTransitionConfig,
  isAndrecompRunnerProvider,
  resolveAndrecompRunnerModel,
  resolveAndrecompRunnerPermissionMode,
  resolveAndrecompRunnerCursorMode,
} from "./andrecomp-runner-permissions.js";

describe("Andrecomp Runner permission defaults", () => {
  it("marks Pi and Copilot qualified with their provider credential bindings", () => {
    expect(ANDRECOMP_RUNNER_ACPX_PROFILES.find(profile => profile.value === "pi"))
      .toMatchObject({ qualified: true, credentialEnvironment: expect.arrayContaining(["OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"]) });
    expect(ANDRECOMP_RUNNER_ACPX_PROFILES.find(profile => profile.value === "copilot"))
      .toMatchObject({ qualified: true, credentialEnvironment: ["COPILOT_GITHUB_TOKEN"] });
  });
  it("defaults Codex to the only qualified non-interactive mode", () => {
    expect(resolveAndrecompRunnerPermissionMode("codex", undefined)).toBe(
      "never",
    );
    expect(resolveAndrecompRunnerPermissionMode("codex", "on-request")).toBe("never");
    expect(resolveAndrecompRunnerPermissionMode("codex", "untrusted")).toBe("never");
  });

  it("defaults Claude and OpenCode to full auto", () => {
    expect(resolveAndrecompRunnerPermissionMode("opencode", undefined)).toBe(
      "allow",
    );
    expect(resolveAndrecompRunnerPermissionMode("acpx", undefined)).toBe(
      "approve-all",
    );
  });

  it.each(["approve-andrecomp", "approve-reads", "deny-all", "approve-all"])("preserves explicit Claude %s settings", (mode) => {
    expect(resolveAndrecompRunnerPermissionMode("acpx", mode)).toBe(mode);
  });

  it.each([
    ["claude_local", "acpxPermissionMode", "approve-all"],
    ["codex_local", "codexPermissionMode", "never"],
    ["opencode_local", "opencodePermissionMode", "allow"],
  ])("uses full auto when converting %s to the new runner", (adapter, key, value) => {
    expect(andrecompRunnerTransitionConfig(adapter, undefined)).toMatchObject({ [key]: value });
  });

  it("recognizes only exact provider identifiers", () => {
    expect(isAndrecompRunnerProvider("codex")).toBe(true);
    expect(isAndrecompRunnerProvider("opencode")).toBe(true);
    expect(isAndrecompRunnerProvider("claude_managed")).toBe(true);
    expect(isAndrecompRunnerProvider("aws_agentcore")).toBe(true);
    expect(isAndrecompRunnerProvider("acpx")).toBe(true);
    expect(isAndrecompRunnerProvider("toString")).toBe(false);
    expect(isAndrecompRunnerProvider("__proto__")).toBe(false);
  });

  it("keeps managed provider permissions under the qualified profile", () => {
    expect(resolveAndrecompRunnerPermissionMode("claude_managed", "never"))
      .toBe("provider-managed");
    expect(resolveAndrecompRunnerPermissionMode("aws_agentcore", "approve-all"))
      .toBe("provider-managed");
  });

  it("uses the Codex default for missing or blank models", () => {
    expect(resolveAndrecompRunnerModel("codex", undefined)).toBe(
      ANDRECOMP_RUNNER_DEFAULT_MODELS.codex,
    );
    expect(resolveAndrecompRunnerModel("codex", "   ")).toBe(
      ANDRECOMP_RUNNER_DEFAULT_MODELS.codex,
    );
  });

  it("preserves an explicit Codex model", () => {
    expect(resolveAndrecompRunnerModel("codex", "gpt-5.5")).toBe("gpt-5.5");
    expect(resolveAndrecompRunnerModel("codex", "  gpt-5.5  ")).toBe("gpt-5.5");
  });
});


describe("Cursor session mode admission", () => {
  it.each([undefined, "agent", "plan", "ask"])("retains mode %s with an explicit Cursor default", mode => {
    expect(resolveAndrecompRunnerCursorMode("acpx", "cursor", mode)).toBe(mode ?? "agent");
  });
  it.each([null, "", "auto", "PLAN", true, {}, ["plan"]])("rejects invalid mode %j", mode => {
    expect(() => resolveAndrecompRunnerCursorMode("acpx", "cursor", mode)).toThrow("Cursor session mode");
  });
  it.each([["codex", "cursor"], ["acpx", "copilot"], ["acpx", "pi"], ["acpx", "claude"]])("rejects mode on %s/%s", (provider, agent) => {
    expect(resolveAndrecompRunnerCursorMode(provider, agent, undefined)).toBeUndefined();
    expect(() => resolveAndrecompRunnerCursorMode(provider, agent, "plan")).toThrow("only for Cursor");
  });
});

describe("Pi thinking configuration", () => {
  it.each([undefined, "off", "low", "high", "max"] as const)("persists exact level %s with low as the fresh-config default", value => {
    expect(resolveAndrecompRunnerPiThinkingLevel("acpx", "pi", value)).toBe(value ?? "low");
  });
  it.each(["medium", "minimal", "xhigh", "", null, 1])("rejects unsupported alias %s", value => {
    expect(() => resolveAndrecompRunnerPiThinkingLevel("acpx", "pi", value)).toThrow();
  });
  it("rejects foreign provider settings", () => {
    expect(() => resolveAndrecompRunnerPiThinkingLevel("codex", "pi", "low")).toThrow(/only/);
    expect(() => resolveAndrecompRunnerPiThinkingLevel("acpx", "cursor", "low")).toThrow(/only/);
    expect(resolveAndrecompRunnerPiThinkingLevel("codex", undefined, undefined)).toBeUndefined();
  });
});
