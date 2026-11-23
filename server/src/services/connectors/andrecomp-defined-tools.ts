import { googleWorkspaceRestToolDefinition, type GoogleWorkspaceRestToolDefinition } from "../google-workspace-rest-dispatch.js";

export type AndrecompDefinedTool = GoogleWorkspaceRestToolDefinition;

type Connection = { config: Record<string, unknown> };

const ANDRECOMP_DEFINED_TOOL_SOURCES: ReadonlyArray<{
  matches: (connection: Connection) => boolean;
  definition: (toolName: string) => AndrecompDefinedTool | null;
}> = [
  { matches: (connection) => connection.config.sourceTemplateKey === "google-workspace", definition: googleWorkspaceRestToolDefinition },
];

export function andrecompDefinedTool(connection: Connection, toolName: string): AndrecompDefinedTool | null {
  return ANDRECOMP_DEFINED_TOOL_SOURCES.find((source) => source.matches(connection))?.definition(toolName) ?? null;
}
