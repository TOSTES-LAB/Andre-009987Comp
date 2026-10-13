import { describe, expect, it } from "vitest";
import {
  normalizeAndrecompOperationalSkillPreference,
  normalizeAndrecompRunnerAdapterConfig,
  ANDRECOMP_OPERATIONAL_SKILL_KEY,
  resolveLegacyAndrecompDesiredSkillNames,
} from "@andrecomp/adapter-utils/server-utils";

const legacyConfig = {
  andrecompSkillSync: {
    desiredSkills: [ANDRECOMP_OPERATIONAL_SKILL_KEY],
  },
};

describe("andrecomp_runner operational skill normalization", () => {
  it("applies full-auto native runner defaults at persistence boundaries", () => {
    expect(normalizeAndrecompRunnerAdapterConfig("andrecomp_runner", {})).toEqual({
      provider: "codex",
      model: "gpt-5.6-sol",
      codexPermissionMode: "never",
      lifecycleMode: "per_turn",
    });
  });

  it("repairs an existing blank model without replacing an explicit model", () => {
    expect(normalizeAndrecompRunnerAdapterConfig("andrecomp_runner", { model: "" }))
      .toMatchObject({ model: "gpt-5.6-sol" });
    expect(normalizeAndrecompRunnerAdapterConfig("andrecomp_runner", { model: "gpt-5.5" }))
      .toMatchObject({ model: "gpt-5.5" });
  });

  it("does not replace a non-Codex provider model with the Codex default", () => {
    expect(normalizeAndrecompRunnerAdapterConfig("andrecomp_runner", {
      provider: "claude_managed",
      model: "claude-sonnet-5",
    })).toMatchObject({
      provider: "claude_managed",
      model: "claude-sonnet-5",
    });
  });

  it("removes the legacy operational skill while preserving optional skills", () => {
    const normalized = normalizeAndrecompOperationalSkillPreference("andrecomp_runner", {
      andrecompSkillSync: {
        desiredSkills: [ANDRECOMP_OPERATIONAL_SKILL_KEY, "company-1/reviewer"],
      },
    });

    expect(normalized).toEqual({
      andrecompSkillSync: { desiredSkills: ["company-1/reviewer"] },
    });
  });

  it("restores the required operational skill through the legacy resolver after switching back", () => {
    const normalized = normalizeAndrecompOperationalSkillPreference("andrecomp_runner", legacyConfig);
    expect(resolveLegacyAndrecompDesiredSkillNames(normalized, [{
      key: ANDRECOMP_OPERATIONAL_SKILL_KEY,
      runtimeName: "andrecomp",
    }])).toEqual([ANDRECOMP_OPERATIONAL_SKILL_KEY]);
  });

  it("does not change direct adapter preferences", () => {
    expect(normalizeAndrecompOperationalSkillPreference("codex_local", legacyConfig)).toBe(legacyConfig);
  });
});
