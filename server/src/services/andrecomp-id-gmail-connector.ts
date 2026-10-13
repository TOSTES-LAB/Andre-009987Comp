/**
 * @deprecated Andrecomp ID is identity-only. Import the Andrecomp Cloud
 * connector names from `andrecomp-cloud-connector.ts` for new code.
 *
 * These aliases keep source compatibility while deployments and persisted app
 * definitions move from the former Andrecomp ID broker prototype.
 */
export {
  GMAIL_CONNECTOR_SCOPES,
  GMAIL_MCP_URL,
  GOOGLE_WORKSPACE_CONNECTOR_PROFILES,
  AndrecompCloudConnectorError as AndrecompIdConnectorError,
  createAndrecompCloudConnector as createAndrecompIdGmailConnector,
  andrecompCloudConnectorCapabilitiesFromEnv as andrecompIdGoogleConnectorCapabilitiesFromEnv,
  andrecompCloudConnectorConfigFromEnv as andrecompIdGmailConnectorConfigFromEnv,
} from "./andrecomp-cloud-connector.js";

export type {
  AndrecompCloudConnector as AndrecompIdGmailConnector,
  AndrecompCloudConnector as AndrecompIdGoogleWorkspaceConnector,
  AndrecompCloudConnectorConfig as AndrecompIdGmailConnectorConfig,
  AndrecompCloudConnectorEnvironment as AndrecompIdConnectorEnvironment,
  AndrecompCloudConnectorOperation as AndrecompIdConnectorOperation,
  SealedGmailCredentials,
  SealedGoogleWorkspaceCredentials,
} from "./andrecomp-cloud-connector.js";
