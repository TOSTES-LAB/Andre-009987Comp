import type { AiSignInRemoval, ManagedGoogleAccessRemoval } from "@andrecomp/shared";
import type { ToastAction, ToastInput, ToastTone } from "../../context/ToastContext";

export const GOOGLE_THIRD_PARTY_ACCESS_URL = "https://myaccount.google.com/connections";

export const GOOGLE_CONTENT_DELETION_NOTICE =
  "Andrecomp then deletes what agents read from Google through it: saved tool results and the transcripts of runs that used it. This starts at once. Andrecomp waits for runs that are still working, and keeps trying until every step succeeds. Comments, documents and files that agents wrote into tasks stay.";

export interface GoogleAccessRemovalNotice {
  body: string;
  tone: ToastTone;
  action?: ToastAction;
}

const openGoogleAccountConnections: ToastAction = {
  label: "Open Google account connections",
  onClick: () => { window.open(GOOGLE_THIRD_PARTY_ACCESS_URL, "_blank", "noopener,noreferrer"); },
};

export function googleAccessRemovalNotice(
  providerAccess: ManagedGoogleAccessRemoval | null | undefined,
  removed: "connection" | "credentials" = "connection",
): GoogleAccessRemovalNotice | null {
  if (providerAccess?.provider !== "google") return null;
  if (providerAccess.result === "ended") {
    return { tone: "success", body: "Andrecomp's access to this Google account was also ended at Google." };
  }
  if (providerAccess.result === "ended_unconfirmed") {
    return {
      tone: "info",
      body: "Andrecomp's access was ended at Google. If more than one Google account was connected here, check your Google account's third-party connections to be sure.",
      action: openGoogleAccountConnections,
    };
  }
  if (providerAccess.result === "other_connections_remain") {
    return {
      tone: "success",
      body: "Other Andrecomp connections still use this Google account, so Google keeps Andrecomp's access until you remove those too.",
    };
  }
  if (providerAccess.result === "retrying") {
    return {
      tone: "info",
      body: "Google didn't confirm that Andrecomp's access has ended yet. Andrecomp will keep trying automatically.",
    };
  }
  return {
    tone: "warn",
    body: `Andrecomp removed the ${removed} but couldn't end its access at Google. You can remove Andrecomp from your Google account's third-party connections.`,
    action: openGoogleAccountConnections,
  };
}

export function aiSignInRemovalNotice(removal: AiSignInRemoval | null | undefined): GoogleAccessRemovalNotice | null {
  if (removal?.provider !== "google") return null;
  if (removal.savedSignIn === "not_deleted") {
    return { tone: "warn", body: "Andrecomp couldn't delete its saved Google sign-in. Disconnect again to retry." };
  }
  const kept = removal.savedSignIn === "kept_shared"
    ? "Another connection still uses this saved Google sign-in, so Andrecomp kept it."
    : "Andrecomp deleted its saved Google sign-in.";
  return {
    tone: "info",
    body: `${kept} The sign-in stays valid at Google until you remove it in your Google account's third-party connections. Removing it there also signs this Google account out of Antigravity everywhere.`,
    action: openGoogleAccountConnections,
  };
}

export function connectionRemovalToast(input: {
  title: string;
  body: string;
  providerAccess: ManagedGoogleAccessRemoval | null | undefined;
  signInRemoval?: AiSignInRemoval | null;
}): ToastInput {
  const notice = googleAccessRemovalNotice(input.providerAccess) ?? aiSignInRemovalNotice(input.signInRemoval);
  return {
    title: input.title,
    body: notice ? `${input.body} ${notice.body}` : input.body,
    tone: notice?.tone ?? "success",
    ...(notice?.action ? { action: notice.action } : {}),
  };
}

export function googleAccessRetrySummary(type: "google_access_ended" | "google_access_not_ended", details: Record<string, unknown> | null): string {
  if (type === "google_access_ended") return "Google confirmed that Andrecomp's access to this Google account has ended";
  if (details?.result === "other_connections_remain") return "Google kept Andrecomp's access because other Andrecomp connections use this Google account";
  return "Andrecomp stopped trying to end its access at Google without a confirmation";
}
