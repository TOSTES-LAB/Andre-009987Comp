import { describe, expect, it } from "vitest";
import { isPostHogDirectDeliveryEnabled, resolveCloudPostHogConfig } from "../services/cloud-posthog-config.js";

const CLOUD = {
  ANDRECOMP_CLOUD_TENANT_SERVER_TOKEN: "tenant-token",
  ANDRECOMP_CLOUD_STACK_ID: "stack-123",
  ANDRECOMP_POSTHOG_PROJECT_TOKEN: "phc_test",
};

describe("resolveCloudPostHogConfig", () => {
  it("is null on a self-hosted install, even with a PostHog token", () => {
    expect(resolveCloudPostHogConfig({})).toBeNull();
    expect(
      resolveCloudPostHogConfig({ ANDRECOMP_POSTHOG_PROJECT_TOKEN: "phc_test", ANDRECOMP_CLOUD_STACK_ID: "stack-123" }),
    ).toBeNull();
  });

  it("is null on Cloud without a token or without a stack id", () => {
    expect(resolveCloudPostHogConfig({ ...CLOUD, ANDRECOMP_POSTHOG_PROJECT_TOKEN: "" })).toBeNull();
    expect(resolveCloudPostHogConfig({ ...CLOUD, ANDRECOMP_POSTHOG_PROJECT_TOKEN: "  " })).toBeNull();
    expect(resolveCloudPostHogConfig({ ...CLOUD, ANDRECOMP_CLOUD_STACK_ID: undefined })).toBeNull();
  });

  it("resolves defaults on a Cloud stack with a token", () => {
    expect(resolveCloudPostHogConfig(CLOUD)).toEqual({
      token: "phc_test",
      host: "https://us.i.posthog.com",
      environment: null,
      stackId: "stack-123",
      directEnabled: true,
      browserEnabled: false,
      replayEnabled: false,
    });
  });

  it("accepts the legacy managed-config Cloud signal", () => {
    const { ANDRECOMP_CLOUD_TENANT_SERVER_TOKEN: _omit, ...rest } = CLOUD;
    expect(resolveCloudPostHogConfig({ ...rest, ANDRECOMP_MANAGED_CONFIG: "{}" })?.stackId).toBe("stack-123");
  });

  it("reads host, environment and the switches", () => {
    const config = resolveCloudPostHogConfig({
      ...CLOUD,
      ANDRECOMP_POSTHOG_HOST: "http://127.0.0.1:9999/",
      ANDRECOMP_POSTHOG_ENVIRONMENT: "staging",
      ANDRECOMP_POSTHOG_DIRECT: "0",
      ANDRECOMP_POSTHOG_BROWSER_ENABLED: "1",
    });
    expect(config).toMatchObject({
      host: "http://127.0.0.1:9999",
      environment: "staging",
      directEnabled: false,
      browserEnabled: true,
      replayEnabled: true,
    });
  });

  it("turns replay off with its own switch and never without the browser switch", () => {
    expect(
      resolveCloudPostHogConfig({
        ...CLOUD,
        ANDRECOMP_POSTHOG_BROWSER_ENABLED: "1",
        ANDRECOMP_POSTHOG_REPLAY_ENABLED: "0",
      })?.replayEnabled,
    ).toBe(false);
    expect(resolveCloudPostHogConfig({ ...CLOUD, ANDRECOMP_POSTHOG_REPLAY_ENABLED: "1" })?.replayEnabled).toBe(false);
  });

  it("turns direct delivery on only with the switch on and an environment", () => {
    expect(isPostHogDirectDeliveryEnabled(null)).toBe(false);
    expect(isPostHogDirectDeliveryEnabled(resolveCloudPostHogConfig(CLOUD))).toBe(false);
    expect(
      isPostHogDirectDeliveryEnabled(resolveCloudPostHogConfig({ ...CLOUD, ANDRECOMP_POSTHOG_ENVIRONMENT: "staging" })),
    ).toBe(true);
    expect(
      isPostHogDirectDeliveryEnabled(
        resolveCloudPostHogConfig({ ...CLOUD, ANDRECOMP_POSTHOG_ENVIRONMENT: "staging", ANDRECOMP_POSTHOG_DIRECT: "0" }),
      ),
    ).toBe(false);
  });
});
