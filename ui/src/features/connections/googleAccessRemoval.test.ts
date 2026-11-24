import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionRemovalToast, GOOGLE_THIRD_PARTY_ACCESS_URL, googleAccessRemovalNotice, googleAccessRetrySummary } from "./googleAccessRemoval";

describe("googleAccessRemovalNotice", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("says nothing for connections that are not Andrecomp-managed Google", () => {
    expect(googleAccessRemovalNotice(undefined)).toBeNull();
    expect(googleAccessRemovalNotice(null)).toBeNull();
  });

  it("says access was ended at Google", () => {
    expect(googleAccessRemovalNotice({ provider: "google", result: "ended", outcomes: ["revoked"] })).toEqual({
      tone: "success",
      body: "Andrecomp's access to this Google account was also ended at Google.",
    });
  });

  it("says other connections keep Google access", () => {
    expect(googleAccessRemovalNotice({ provider: "google", result: "other_connections_remain", outcomes: ["other_connections_remain"] })).toEqual({
      tone: "success",
      body: "Other Andrecomp connections still use this Google account, so Google keeps Andrecomp's access until you remove those too.",
    });
  });

  it("offers Google's own page when access could not be ended, without showing codes", () => {
    const open = vi.fn(() => null);
    vi.stubGlobal("window", { open });
    const notice = googleAccessRemovalNotice({ provider: "google", result: "not_ended", outcomes: ["revocation_not_available"] });
    expect(notice?.tone).toBe("warn");
    expect(notice?.body).toBe("Andrecomp removed the connection but couldn't end its access at Google. You can remove Andrecomp from your Google account's third-party connections.");
    expect(notice?.body).not.toMatch(/revocation|broker|_/);
    notice?.action?.onClick?.();
    expect(open).toHaveBeenCalledWith(GOOGLE_THIRD_PARTY_ACCESS_URL, "_blank", "noopener,noreferrer");
    expect(GOOGLE_THIRD_PARTY_ACCESS_URL).toBe("https://myaccount.google.com/connections");
  });
  it("says Andrecomp keeps trying when Google has not confirmed yet, with no action to take", () => {
    const notice = googleAccessRemovalNotice({ provider: "google", result: "retrying", outcomes: ["broker_unavailable"] });
    expect(notice).toEqual({
      tone: "info",
      body: "Google didn't confirm that Andrecomp's access has ended yet. Andrecomp will keep trying automatically.",
    });
    expect(notice?.body).not.toMatch(/revocation|broker|_/);
    expect(connectionRemovalToast({ title: "Connection removed", body: "Removed.", providerAccess: { provider: "google", result: "retrying", outcomes: ["provider_revocation_failed"] } }))
      .toEqual({ title: "Connection removed", body: "Removed. Google didn't confirm that Andrecomp's access has ended yet. Andrecomp will keep trying automatically.", tone: "info" });
  });

  it("says access was ended but asks to check when the Google account cannot be confirmed", () => {
    const notice = googleAccessRemovalNotice({ provider: "google", result: "ended_unconfirmed", outcomes: ["other_connections_remain", "revoked"] });
    expect(notice?.tone).toBe("info");
    expect(notice?.body).toBe("Andrecomp's access was ended at Google. If more than one Google account was connected here, check your Google account's third-party connections to be sure.");
    expect(notice?.action?.label).toBe("Open Google account connections");
  });

  it("builds the removal toast with or without a Google outcome", () => {
    expect(connectionRemovalToast({ title: "Connection removed", body: "Removed.", providerAccess: undefined }))
      .toEqual({ title: "Connection removed", body: "Removed.", tone: "success" });
    expect(connectionRemovalToast({ title: "Connection removed", body: "Removed.", providerAccess: { provider: "google", result: "ended", outcomes: ["revoked"] } }))
      .toEqual({ title: "Connection removed", body: "Removed. Andrecomp's access to this Google account was also ended at Google.", tone: "success" });
  });

  it("describes how a background retry to end Google access finished, without codes", () => {
    expect(googleAccessRetrySummary("google_access_ended", { result: "ended" })).toBe("Google confirmed that Andrecomp's access to this Google account has ended");
    expect(googleAccessRetrySummary("google_access_not_ended", { result: "other_connections_remain" })).toBe("Google kept Andrecomp's access because other Andrecomp connections use this Google account");
    expect(googleAccessRetrySummary("google_access_not_ended", { result: "gave_up" })).toBe("Andrecomp stopped trying to end its access at Google without a confirmation");
  });
});
