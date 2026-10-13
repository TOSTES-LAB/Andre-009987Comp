import { describe, expect, it } from "vitest";
import {
  getCloudStackContext,
  isCloudManagedInstance,
  type CloudInstanceEnv,
} from "../services/cloud-instance.js";

describe("isCloudManagedInstance", () => {
  it("unifies both prior signals without weakening either restrictive floor", () => {
    const cases: CloudInstanceEnv[] = [
      {},
      { ANDRECOMP_CLOUD_TENANT_SERVER_TOKEN: "tenant-token" },
      { ANDRECOMP_MANAGED_CONFIG: "" },
      {
        ANDRECOMP_CLOUD_TENANT_SERVER_TOKEN: "tenant-token",
        ANDRECOMP_MANAGED_CONFIG: "managed-document",
      },
    ];

    for (const env of cases) {
      const priorTokenFloor = Boolean(env.ANDRECOMP_CLOUD_TENANT_SERVER_TOKEN?.trim());
      const priorManagedConfigFloor = env.ANDRECOMP_MANAGED_CONFIG !== undefined;
      const canonicalFloor = isCloudManagedInstance(env);

      expect(canonicalFloor).toBe(priorTokenFloor || priorManagedConfigFloor);
      expect(canonicalFloor || !priorTokenFloor).toBe(true);
      expect(canonicalFloor || !priorManagedConfigFloor).toBe(true);
    }
  });

  it("does not treat a blank tenant token alone as a managed signal", () => {
    expect(isCloudManagedInstance({ ANDRECOMP_CLOUD_TENANT_SERVER_TOKEN: "   " })).toBe(false);
  });
});

describe("getCloudStackContext", () => {
  it("returns null outside Andrecomp Cloud even when stray stack metadata exists", () => {
    expect(getCloudStackContext({ ANDRECOMP_STACK_SLUG: "stray-stack" })).toBeNull();
  });

  it("returns normalized provisioner metadata for cloud instances", () => {
    expect(getCloudStackContext({
      ANDRECOMP_CLOUD_TENANT_SERVER_TOKEN: "tenant-token",
      ANDRECOMP_CLOUD_STACK_ID: " stack-1 ",
      ANDRECOMP_STACK_SLUG: " acme ",
      ANDRECOMP_CLOUD_ACCOUNT_GROUP_ID: " account-group-1 ",
      ANDRECOMP_PRIMARY_HOST: " acme.andrecomp.app ",
      ANDRECOMP_CLOUD_API_ORIGIN: " https://app.andrecomp.app ",
    })).toEqual({
      stackId: "stack-1",
      stackSlug: "acme",
      accountGroupId: "account-group-1",
      primaryHost: "acme.andrecomp.app",
      cloudOrigin: "https://app.andrecomp.app",
    });
  });

  it("represents missing managed metadata explicitly without failing health checks", () => {
    expect(getCloudStackContext({ ANDRECOMP_MANAGED_CONFIG: "managed-document" })).toEqual({
      stackId: null,
      stackSlug: null,
      accountGroupId: null,
      primaryHost: null,
      cloudOrigin: null,
    });
  });
});
