import { isGoogleWorkspaceConnectorProfileId } from "./google-workspace-connectors.js";
import type { AppDefinition, ConnectionMethodDef } from "./types/app-definition.js";

export function isCloudOnlyConnectionMethod(method: ConnectionMethodDef): boolean {
  return (method.oauthStrategy === "andrecomp_cloud_connector" || method.oauthStrategy === "andrecomp_id_connector")
    && isGoogleWorkspaceConnectorProfileId(method.connectorProfile ?? "");
}

export function appDefinitionForDeployment(app: AppDefinition, deployment: { cloudHosted: boolean }): AppDefinition {
  if (deployment.cloudHosted || !app.methods.some(isCloudOnlyConnectionMethod)) return app;
  return { ...app, methods: app.methods.filter((method) => !isCloudOnlyConnectionMethod(method)) };
}

export const GOOGLE_SIGN_IN_CLOUD_ONLY_MESSAGE =
  "Connecting Google through Andrecomp works only on Andrecomp Cloud. On your own Andrecomp server, connect Google with your own Google OAuth client.";
