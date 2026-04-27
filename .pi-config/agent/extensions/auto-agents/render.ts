import type { Theme, ToolRenderResultOptions } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { AutoAgentsReadDetails } from "./types";

export function formatAutoAgentsSummary(
  result: { details?: AutoAgentsReadDetails },
  _options: ToolRenderResultOptions,
  theme: Theme,
): string | undefined {
  const loaded = result.details?.autoAgents?.loaded ?? [];
  if (loaded.length === 0) return undefined;

  return loaded.map((entry) => `${theme.fg("success", "loaded:")} ${theme.fg("accent", entry.path)}`).join("\n");
}

export function renderAutoAgentsSummary(
  result: { details?: AutoAgentsReadDetails },
  options: ToolRenderResultOptions,
  theme: Theme,
): Text | undefined {
  const text = formatAutoAgentsSummary(result, options, theme);
  return text ? new Text(text, 0, 0) : undefined;
}
