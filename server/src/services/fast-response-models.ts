import { models as anthropic } from "@andrecomp/adapter-claude-local";
import { models as openai } from "@andrecomp/adapter-codex-local";
import { models as google } from "@andrecomp/adapter-gemini-local";
import { models as xai } from "@andrecomp/adapter-grok-local";
import type { AiConnectionMetadata } from "@andrecomp/shared";

/** Catalogs follow the saved API connection, never the host CLI's credentials or environment. */
export function fastResponseCatalogModels(connection: Pick<AiConnectionMetadata, "provider" | "routing">) {
  if (connection.routing) return connection.routing.models ?? [];
  return { anthropic, openai, google, xai, openrouter: [] }[connection.provider];
}
