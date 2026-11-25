import { googleWorkspaceRestFallbackDefinition, googleWorkspaceRestToolDefinition } from "../google-workspace-rest-dispatch.js";
import type { toolConnections } from "@andrecomp/db";
import { pluginConnectionMethod, pluginConnectionToolDefinition } from "../plugin-connector-runtime.js";
import { shouldQuarantineNewEntries } from "../tool-access/catalog/descriptors.js";

export interface AndrecompDefinedToolDefinition {
  name: string;
  title: string | null;
  description: string | null;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown> | null;
  annotations: Record<string, unknown>;
}

type Connection = { config: Record<string, unknown> };

const ANDRECOMP_DEFINED_TOOL_SOURCES: ReadonlyArray<{
  matches: (connection: Connection) => boolean;
  definition: (toolName: string) => AndrecompDefinedToolDefinition | null;
  formerDefinition: (toolName: string) => AndrecompDefinedToolDefinition | null;
}> = [
  {
    matches: (connection) => connection.config.sourceTemplateKey === "google-workspace",
    definition: googleWorkspaceRestToolDefinition,
    formerDefinition: googleWorkspaceRestFallbackDefinition,
  },
];

export function andrecompDefinedTool(connection: Connection, toolName: string): AndrecompDefinedToolDefinition | null {
  return ANDRECOMP_DEFINED_TOOL_SOURCES.find((source) => source.matches(connection))?.definition(toolName) ?? null;
}

export function formerAndrecompDefinedTool(connection: Connection, toolName: string): AndrecompDefinedToolDefinition | null {
  return ANDRECOMP_DEFINED_TOOL_SOURCES.find((source) => source.matches(connection))?.formerDefinition(toolName) ?? null;
}

export function currentConnectionToolDefinition(connection: typeof toolConnections.$inferSelect, toolName: string): AndrecompDefinedToolDefinition | null {
  const trusted = andrecompDefinedTool(connection, toolName);
  if (trusted) return trusted;
  if (shouldQuarantineNewEntries(connection)) return null;
  if (pluginConnectionMethod(connection)?.method.tools?.kind !== "static") return null;
  return pluginConnectionToolDefinition(connection, toolName);
}
