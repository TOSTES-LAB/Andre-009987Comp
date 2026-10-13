import type { PluginEvent } from "@andrecomp/plugin-sdk";

export interface ActivityPublication {
  companyId: string;
  payload: Record<string, unknown>;
  pluginEvent: PluginEvent | null;
}
