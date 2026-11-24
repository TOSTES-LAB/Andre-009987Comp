import { describe, expect, it } from "vitest";
import { CONNECTABLE_APP_DEFINITIONS, getConnectableAppDefinition } from "./app-definitions.js";
import { appDefinitionForDeployment, isCloudOnlyConnectionMethod } from "./google-sign-in-deployment.js";

const googleApps = CONNECTABLE_APP_DEFINITIONS.filter((app) =>
  app.methods.some((method) => method.connectorProfile && isCloudOnlyConnectionMethod(method)));

describe("Andrecomp's Google sign-in by deployment", () => {
  it("finds every Google app that offers Andrecomp's Google sign-in", () => {
    expect(googleApps.map((app) => app.slug).sort()).toEqual([
      "gmail", "google-calendar", "google-chat", "google-docs", "google-drive", "google-people",
      "google-sheets", "google-slides", "google-workspace", "google-workspace-search",
    ]);
  });

  it("offers only the customer-owned Google client on a self-hosted instance", () => {
    for (const app of googleApps) {
      const selfHosted = appDefinitionForDeployment(app, { cloudHosted: false });
      expect(selfHosted.methods.some(isCloudOnlyConnectionMethod), app.slug).toBe(false);
      expect(selfHosted.methods.length, app.slug).toBeGreaterThan(0);
      expect(selfHosted.methods.every((method) => !method.oauthStrategy), app.slug).toBe(true);
    }
    expect(appDefinitionForDeployment(getConnectableAppDefinition("google-workspace")!, { cloudHosted: false }).methods
      .map((method) => method.key)).toEqual(["customer-workspace-oauth"]);
  });

  it("leaves every app unchanged on Andrecomp Cloud", () => {
    for (const app of CONNECTABLE_APP_DEFINITIONS) {
      expect(appDefinitionForDeployment(app, { cloudHosted: true })).toBe(app);
    }
  });

  it("leaves other providers' Andrecomp sign-in on a self-hosted instance", () => {
    for (const app of CONNECTABLE_APP_DEFINITIONS.filter((candidate) => !googleApps.includes(candidate))) {
      expect(appDefinitionForDeployment(app, { cloudHosted: false }), app.slug).toBe(app);
    }
  });
});
