import {
  andrecompCloudConnectorEnrollmentStatus,
  type AndrecompCloudConnectorEnrollmentStatus,
} from "./andrecomp-cloud-connector-enrollment.js";
import {
  createAndrecompCloudConnector,
  andrecompCloudConnectorConfigFromEnv,
} from "./andrecomp-cloud-connector.js";

export async function reconcileAndrecompCloudConnectorEnrollmentStatus(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<AndrecompCloudConnectorEnrollmentStatus> {
  const local = andrecompCloudConnectorEnrollmentStatus(env);
  if (!local.configured) return local;
  const config = andrecompCloudConnectorConfigFromEnv(env);
  if (!config) return { ...local, configured: false, status: "not_configured" };
  try {
    const status = await createAndrecompCloudConnector({ config, request }).getInstanceStatus();
    if (status === "active") return { ...local, configured: true, status: "active" };
    if (status === "suspended") return { ...local, configured: false, status: "suspended" };
    return { ...local, configured: false, status: "not_configured" };
  } catch {
    return { ...local, configured: false, status: "unverified" };
  }
}
