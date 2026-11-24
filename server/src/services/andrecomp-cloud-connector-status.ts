import {
  andrecompCloudConnectorEnrollmentStatus,
  type AndrecompCloudConnectorEnrollmentStatus,
} from "./andrecomp-cloud-connector-enrollment.js";
import {
  createAndrecompCloudConnector,
  isTransientAndrecompCloudConnectorError,
  andrecompCloudConnectorConfigFromEnv,
} from "./andrecomp-cloud-connector.js";

export async function reconcileAndrecompCloudConnectorEnrollmentStatus(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
  onRemoved?: () => Promise<unknown>,
): Promise<AndrecompCloudConnectorEnrollmentStatus> {
  const local = andrecompCloudConnectorEnrollmentStatus(env);
  if (!local.configured) return local;
  const config = andrecompCloudConnectorConfigFromEnv(env);
  if (!config) return { ...local, configured: false, status: "not_configured" };
  try {
    const status = await createAndrecompCloudConnector({ config, request }).getConfirmedInstanceStatus();
    if (status === "active") return { ...local, configured: true, status: "active" };
    if (status === "suspended") return { ...local, configured: false, status: "suspended" };
    if (status === "removed") await onRemoved?.().catch(() => undefined);
    return { ...local, configured: false, status: "not_configured" };
  } catch (error) {
    return {
      ...local,
      configured: false,
      status: isTransientAndrecompCloudConnectorError(error) ? "unreachable" : "unverified",
    };
  }
}
