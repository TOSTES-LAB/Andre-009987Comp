import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AndrecompApiClient } from "./client.js";
import { readConfigFromEnv, type AndrecompMcpConfig } from "./config.js";
import { createToolDefinitions } from "./tools.js";

export function createAndrecompMcpServer(config: AndrecompMcpConfig = readConfigFromEnv()) {
  const server = new McpServer({
    name: "andrecomp",
    version: "0.1.0",
  });

  const client = new AndrecompApiClient(config);
  const tools = createToolDefinitions(client);
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema.shape, tool.execute);
  }

  return {
    server,
    tools,
    client,
  };
}

export async function runServer(config: AndrecompMcpConfig = readConfigFromEnv()) {
  const { server } = createAndrecompMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
